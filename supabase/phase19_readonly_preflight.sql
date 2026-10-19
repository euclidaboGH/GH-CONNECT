-- GH-CONNECT Phase 19 preflight. READ-ONLY with respect to application data.
-- Run against Testnet first. It does not apply migrations or change bucket visibility.
CREATE TEMP TABLE IF NOT EXISTS gh_phase19_preflight_results (
  category text NOT NULL,
  object_name text NOT NULL,
  status text NOT NULL,
  detail text,
  row_count bigint
) ON COMMIT PRESERVE ROWS;
TRUNCATE gh_phase19_preflight_results;

DO $$
DECLARE r record; n bigint; v_version text; v_name text; v_bucket_public boolean;
BEGIN
  -- Actual Supabase migration history (if exposed in this project).
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM supabase_migrations.schema_migrations' INTO n;
    INSERT INTO gh_phase19_preflight_results VALUES ('migration-history','supabase_migrations.schema_migrations','FOUND','Actual migration history is available; compare every repository filename/version before apply.',n);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations' AND column_name='name') THEN
      FOR v_version,v_name IN EXECUTE 'SELECT version::text, COALESCE(name::text, '''') FROM supabase_migrations.schema_migrations ORDER BY version' LOOP
        INSERT INTO gh_phase19_preflight_results VALUES ('applied-migration',v_version,'APPLIED',v_name,NULL);
      END LOOP;
    ELSE
      FOR v_version IN EXECUTE 'SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version' LOOP
        INSERT INTO gh_phase19_preflight_results VALUES ('applied-migration',v_version,'APPLIED','Migration name column is not present in this Supabase history schema.',NULL);
      END LOOP;
    END IF;
    FOREACH v_version IN ARRAY ARRAY['202610190002','202610250005','202610250003','202610250004'] LOOP
      IF EXISTS (SELECT 1 FROM gh_phase19_preflight_results WHERE category='applied-migration' AND object_name=v_version) THEN
        INSERT INTO gh_phase19_preflight_results VALUES ('phase19-critical-migration',v_version,'ALREADY_APPLIED','Inspect actual function/table definitions before re-running or skipping.',NULL);
      ELSE
        INSERT INTO gh_phase19_preflight_results VALUES ('phase19-critical-migration',v_version,'NOT_FOUND_IN_HISTORY','Do not assume absent means safe to apply; compare migration inventory, schema and data first.',NULL);
      END IF;
    END LOOP;
  ELSE
    INSERT INTO gh_phase19_preflight_results VALUES ('migration-history','supabase_migrations.schema_migrations','NOT_VISIBLE','Use Supabase CLI migration list or SQL editor with suitable permissions to inspect history.',NULL);
  END IF;

  -- Check bucket visibility; this script never modifies it.
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    EXECUTE 'SELECT "public" FROM storage.buckets WHERE id = $1 OR name = $1 LIMIT 1' INTO v_bucket_public USING 'gh-media';
    IF v_bucket_public IS NULL THEN
      INSERT INTO gh_phase19_preflight_results VALUES ('media-bucket','gh-media','NOT_FOUND','Confirm configured GH_MEDIA_BUCKET and inventory the actual bucket.',NULL);
    ELSE
      INSERT INTO gh_phase19_preflight_results VALUES ('media-bucket','gh-media',CASE WHEN v_bucket_public THEN 'PUBLIC' ELSE 'PRIVATE' END,'No setting changed. Do not switch to private until all legacy references and two-user access cases pass.',NULL);
    END IF;
  ELSE
    INSERT INTO gh_phase19_preflight_results VALUES ('media-bucket','storage.buckets','NOT_VISIBLE','Storage schema not visible to current SQL role.',NULL);
  END IF;

  -- Inventory direct public Storage URLs across public base tables, not just known consumers.
  -- This is a row count (a row may contain more than one URL); any nonzero result requires review.
  FOR r IN SELECT table_schema,table_name FROM information_schema.tables
           WHERE table_schema='public' AND table_type='BASE TABLE'
             AND table_name NOT LIKE 'gh_phase19_%'
             AND table_name NOT IN ('gh_media_assets')
  LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM %I.%I t WHERE to_jsonb(t)::text ILIKE %L',
        r.table_schema,r.table_name,'%/storage/v1/object/public/%') INTO n;
      IF n>0 THEN
        INSERT INTO gh_phase19_preflight_results VALUES ('legacy-public-url',r.table_schema||'.'||r.table_name,'REVIEW_REQUIRED','Rows still contain direct public Storage URLs; migrate references and validate access.',n);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO gh_phase19_preflight_results VALUES ('legacy-public-url',r.table_schema||'.'||r.table_name,'SCAN_ERROR',SQLSTATE||': '||SQLERRM,NULL);
    END;
  END LOOP;

  -- Detect registry/storage mismatches without deleting or rewriting objects.
  IF to_regclass('public.gh_media_assets') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM public.gh_media_assets m
        LEFT JOIN storage.objects o ON o.bucket_id=m.bucket AND o.name=m.storage_path
        WHERE m.status='ready' AND m.deleted_at IS NULL AND o.name IS NULL$q$ INTO n;
      INSERT INTO gh_phase19_preflight_results VALUES ('media-registry','ready assets missing Storage object',CASE WHEN n=0 THEN 'PASS' ELSE 'REVIEW_REQUIRED' END,'Resolve missing objects before private-bucket cutover.',n);
      EXECUTE $q$SELECT count(*) FROM storage.objects o
        LEFT JOIN public.gh_media_assets m ON m.bucket=o.bucket_id AND m.storage_path=o.name
        WHERE o.bucket_id='gh-media' AND m.id IS NULL$q$ INTO n;
      INSERT INTO gh_phase19_preflight_results VALUES ('media-registry','unregistered objects in gh-media',CASE WHEN n=0 THEN 'PASS' ELSE 'REVIEW_REQUIRED' END,'Inventory/import these objects or document why they are not application media.',n);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO gh_phase19_preflight_results VALUES ('media-registry','gh_media_assets/storage.objects','SCAN_ERROR',SQLSTATE||': '||SQLERRM,NULL);
    END;
  ELSE
    INSERT INTO gh_phase19_preflight_results VALUES ('media-registry','gh_media_assets/storage.objects','NOT_VISIBLE','Apply media registry migration on Testnet and rerun before cutover.',NULL);
  END IF;
END $$;

SELECT category,object_name,status,detail,row_count
FROM gh_phase19_preflight_results
ORDER BY CASE status WHEN 'SCAN_ERROR' THEN 0 WHEN 'REVIEW_REQUIRED' THEN 1 WHEN 'PUBLIC' THEN 2 WHEN 'NOT_FOUND_IN_HISTORY' THEN 3 ELSE 4 END,category,object_name;
