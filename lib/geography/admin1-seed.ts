/**
 * Admin1 (state/province/region) + major localities for non-Nigeria seed countries.
 * Structure mirrors Nigeria: expandable admin2 without UI redesign.
 */

export const ADMIN1_BY_COUNTRY: Record<string, { id: string; name: string }[]> = {
  eg: [
    { id: "eg-cai", name: "Cairo" }, { id: "eg-giz", name: "Giza" }, { id: "eg-alx", name: "Alexandria" },
    { id: "eg-dk", name: "Dakahlia" }, { id: "eg-asw", name: "Aswan" }, { id: "eg-lux", name: "Luxor" },
    { id: "eg-suz", name: "Suez" }, { id: "eg-red", name: "Red Sea" },
  ],
  za: [
    { id: "za-gt", name: "Gauteng" }, { id: "za-wc", name: "Western Cape" }, { id: "za-kzn", name: "KwaZulu-Natal" },
    { id: "za-ec", name: "Eastern Cape" }, { id: "za-fs", name: "Free State" }, { id: "za-lp", name: "Limpopo" },
    { id: "za-mp", name: "Mpumalanga" }, { id: "za-nw", name: "North West" }, { id: "za-nc", name: "Northern Cape" },
  ],
  ke: [
    { id: "ke-nrb", name: "Nairobi" }, { id: "ke-msa", name: "Mombasa" }, { id: "ke-ksm", name: "Kisumu" },
    { id: "ke-nkr", name: "Nakuru" }, { id: "ke-eld", name: "Uasin Gishu" }, { id: "ke-kbu", name: "Kiambu" },
    { id: "ke-kil", name: "Kilifi" }, { id: "ke-kit", name: "Kitui" },
  ],
  gh: [
    { id: "gh-ga", name: "Greater Accra" }, { id: "gh-as", name: "Ashanti" }, { id: "gh-wr", name: "Western" },
    { id: "gh-cr", name: "Central" }, { id: "gh-er", name: "Eastern" }, { id: "gh-nr", name: "Northern" },
    { id: "gh-vr", name: "Volta" }, { id: "gh-ue", name: "Upper East" }, { id: "gh-uw", name: "Upper West" },
  ],
  ma: [
    { id: "ma-cs", name: "Casablanca-Settat" }, { id: "ma-rs", name: "Rabat-Salé-Kénitra" },
    { id: "ma-ms", name: "Marrakesh-Safi" }, { id: "ma-fm", name: "Fès-Meknès" },
    { id: "ma-tt", name: "Tangier-Tetouan-Al Hoceima" }, { id: "ma-sm", name: "Souss-Massa" },
  ],
  cn: [
    { id: "cn-bj", name: "Beijing" }, { id: "cn-sh", name: "Shanghai" }, { id: "cn-gd", name: "Guangdong" },
    { id: "cn-zj", name: "Zhejiang" }, { id: "cn-js", name: "Jiangsu" }, { id: "cn-sc", name: "Sichuan" },
    { id: "cn-hb", name: "Hubei" }, { id: "cn-sd", name: "Shandong" },
  ],
  in: [
    { id: "in-mh", name: "Maharashtra" }, { id: "in-dl", name: "Delhi" }, { id: "in-ka", name: "Karnataka" },
    { id: "in-tn", name: "Tamil Nadu" }, { id: "in-up", name: "Uttar Pradesh" }, { id: "in-wb", name: "West Bengal" },
    { id: "in-gj", name: "Gujarat" }, { id: "in-tg", name: "Telangana" }, { id: "in-kl", name: "Kerala" },
  ],
  jp: [
    { id: "jp-tyo", name: "Tokyo" }, { id: "jp-os", name: "Osaka" }, { id: "jp-kn", name: "Kanagawa" },
    { id: "jp-ai", name: "Aichi" }, { id: "jp-hk", name: "Hokkaido" }, { id: "jp-ky", name: "Kyoto" },
    { id: "jp-fk", name: "Fukuoka" },
  ],
  kr: [
    { id: "kr-su", name: "Seoul" }, { id: "kr-bs", name: "Busan" }, { id: "kr-gg", name: "Gyeonggi" },
    { id: "kr-ic", name: "Incheon" }, { id: "kr-dj", name: "Daejeon" }, { id: "kr-dg", name: "Daegu" },
  ],
  id: [
    { id: "id-jk", name: "Jakarta" }, { id: "id-jb", name: "West Java" }, { id: "id-jt", name: "Central Java" },
    { id: "id-ji", name: "East Java" }, { id: "id-ba", name: "Bali" }, { id: "id-su", name: "North Sumatra" },
  ],
  sa: [
    { id: "sa-ru", name: "Riyadh" }, { id: "sa-mk", name: "Makkah" }, { id: "sa-ep", name: "Eastern Province" },
    { id: "sa-md", name: "Medina" }, { id: "sa-as", name: "Asir" },
  ],
  gb: [
    { id: "gb-eng", name: "England" }, { id: "gb-sct", name: "Scotland" }, { id: "gb-wls", name: "Wales" },
    { id: "gb-nir", name: "Northern Ireland" },
  ],
  fr: [
    { id: "fr-idf", name: "Île-de-France" }, { id: "fr-ara", name: "Auvergne-Rhône-Alpes" },
    { id: "fr-naq", name: "Nouvelle-Aquitaine" }, { id: "fr-occ", name: "Occitanie" },
    { id: "fr-pac", name: "Provence-Alpes-Côte d'Azur" }, { id: "fr-bre", name: "Brittany" },
  ],
  de: [
    { id: "de-by", name: "Bavaria" }, { id: "de-nw", name: "North Rhine-Westphalia" },
    { id: "de-be", name: "Berlin" }, { id: "de-bw", name: "Baden-Württemberg" },
    { id: "de-hh", name: "Hamburg" }, { id: "de-he", name: "Hesse" },
  ],
  it: [
    { id: "it-lom", name: "Lombardy" }, { id: "it-laz", name: "Lazio" }, { id: "it-cam", name: "Campania" },
    { id: "it-sic", name: "Sicily" }, { id: "it-ven", name: "Veneto" }, { id: "it-pie", name: "Piedmont" },
  ],
  es: [
    { id: "es-md", name: "Madrid" }, { id: "es-ct", name: "Catalonia" }, { id: "es-an", name: "Andalusia" },
    { id: "es-vc", name: "Valencia" }, { id: "es-pv", name: "Basque Country" }, { id: "es-ga", name: "Galicia" },
  ],
  nl: [
    { id: "nl-nh", name: "North Holland" }, { id: "nl-zh", name: "South Holland" }, { id: "nl-ut", name: "Utrecht" },
    { id: "nl-nb", name: "North Brabant" }, { id: "nl-ge", name: "Gelderland" },
  ],
  us: [
    { id: "us-ca", name: "California" }, { id: "us-ny", name: "New York" }, { id: "us-tx", name: "Texas" },
    { id: "us-fl", name: "Florida" }, { id: "us-il", name: "Illinois" }, { id: "us-wa", name: "Washington" },
    { id: "us-ga", name: "Georgia" }, { id: "us-ma", name: "Massachusetts" }, { id: "us-pa", name: "Pennsylvania" },
  ],
  ca: [
    { id: "ca-on", name: "Ontario" }, { id: "ca-qc", name: "Quebec" }, { id: "ca-bc", name: "British Columbia" },
    { id: "ca-ab", name: "Alberta" }, { id: "ca-mb", name: "Manitoba" }, { id: "ca-ns", name: "Nova Scotia" },
  ],
  mx: [
    { id: "mx-cmx", name: "Mexico City" }, { id: "mx-jal", name: "Jalisco" }, { id: "mx-nl", name: "Nuevo León" },
    { id: "mx-yuc", name: "Yucatán" }, { id: "mx-qroo", name: "Quintana Roo" }, { id: "mx-pue", name: "Puebla" },
  ],
  cu: [
    { id: "cu-hav", name: "Havana" }, { id: "cu-stg", name: "Santiago de Cuba" }, { id: "cu-cam", name: "Camagüey" },
    { id: "cu-hol", name: "Holguín" }, { id: "cu-mat", name: "Matanzas" },
  ],
  jm: [
    { id: "jm-kin", name: "Kingston" }, { id: "jm-sa", name: "Saint Andrew" }, { id: "jm-sc", name: "Saint Catherine" },
    { id: "jm-sj", name: "Saint James" }, { id: "jm-cl", name: "Clarendon" },
  ],
  cr: [
    { id: "cr-sj", name: "San José" }, { id: "cr-al", name: "Alajuela" }, { id: "cr-ca", name: "Cartago" },
    { id: "cr-he", name: "Heredia" }, { id: "cr-pu", name: "Puntarenas" }, { id: "cr-li", name: "Limón" },
  ],
  br: [
    { id: "br-sp", name: "São Paulo" }, { id: "br-rj", name: "Rio de Janeiro" }, { id: "br-mg", name: "Minas Gerais" },
    { id: "br-ba", name: "Bahia" }, { id: "br-rs", name: "Rio Grande do Sul" }, { id: "br-df", name: "Federal District" },
  ],
  ar: [
    { id: "ar-ba", name: "Buenos Aires" }, { id: "ar-cba", name: "Córdoba" }, { id: "ar-sf", name: "Santa Fe" },
    { id: "ar-mza", name: "Mendoza" }, { id: "ar-tuc", name: "Tucumán" },
  ],
  co: [
    { id: "co-cun", name: "Cundinamarca" }, { id: "co-ant", name: "Antioquia" }, { id: "co-val", name: "Valle del Cauca" },
    { id: "co-atl", name: "Atlántico" }, { id: "co-san", name: "Santander" },
  ],
  cl: [
    { id: "cl-rm", name: "Metropolitana" }, { id: "cl-vs", name: "Valparaíso" }, { id: "cl-bi", name: "Biobío" },
    { id: "cl-ar", name: "Araucanía" }, { id: "cl-ll", name: "Los Lagos" },
  ],
  pe: [
    { id: "pe-lim", name: "Lima" }, { id: "pe-are", name: "Arequipa" }, { id: "pe-cus", name: "Cusco" },
    { id: "pe-lal", name: "La Libertad" }, { id: "pe-piu", name: "Piura" },
  ],
  ve: [
    { id: "ve-mir", name: "Miranda" }, { id: "ve-zul", name: "Zulia" }, { id: "ve-car", name: "Carabobo" },
    { id: "ve-lar", name: "Lara" }, { id: "ve-df", name: "Capital District" },
  ],
  au: [
    { id: "au-nsw", name: "New South Wales" }, { id: "au-vic", name: "Victoria" }, { id: "au-qld", name: "Queensland" },
    { id: "au-wa", name: "Western Australia" }, { id: "au-sa", name: "South Australia" }, { id: "au-act", name: "Australian Capital Territory" },
  ],
  nz: [
    { id: "nz-auk", name: "Auckland" }, { id: "nz-wgn", name: "Wellington" }, { id: "nz-can", name: "Canterbury" },
    { id: "nz-wko", name: "Waikato" }, { id: "nz-ota", name: "Otago" },
  ],
  pg: [
    { id: "pg-ncd", name: "National Capital District" }, { id: "pg-mor", name: "Morobe" },
    { id: "pg-eh", name: "Eastern Highlands" }, { id: "pg-wh", name: "Western Highlands" },
  ],
  fj: [
    { id: "fj-cen", name: "Central" }, { id: "fj-wes", name: "Western" }, { id: "fj-nor", name: "Northern" },
    { id: "fj-eas", name: "Eastern" },
  ],
  ws: [
    { id: "ws-tua", name: "Tuamasaga" }, { id: "ws-aan", name: "A'ana" }, { id: "ws-atu", name: "Atua" },
  ],
  to: [
    { id: "to-ton", name: "Tongatapu" }, { id: "to-vai", name: "Vavaʻu" }, { id: "to-haa", name: "Haʻapai" },
  ],
}

/** Major cities keyed by admin1 id */
export const LOCALITIES_BY_ADMIN1: Record<string, string[]> = {
  "eg-cai": ["Cairo", "Nasr City", "Heliopolis"],
  "eg-giz": ["Giza", "6th of October"],
  "eg-alx": ["Alexandria"],
  "za-gt": ["Johannesburg", "Pretoria", "Sandton"],
  "za-wc": ["Cape Town", "Stellenbosch"],
  "za-kzn": ["Durban", "Pietermaritzburg"],
  "ke-nrb": ["Nairobi", "Westlands", "Karen"],
  "ke-msa": ["Mombasa"],
  "ke-ksm": ["Kisumu"],
  "gh-ga": ["Accra", "Tema", "Madina"],
  "gh-as": ["Kumasi"],
  "gh-nr": ["Tamale"],
  "ma-cs": ["Casablanca"],
  "ma-rs": ["Rabat", "Salé"],
  "ma-ms": ["Marrakesh"],
  "cn-bj": ["Beijing"],
  "cn-sh": ["Shanghai"],
  "cn-gd": ["Guangzhou", "Shenzhen"],
  "in-mh": ["Mumbai", "Pune"],
  "in-dl": ["New Delhi", "Delhi"],
  "in-ka": ["Bengaluru", "Mysuru"],
  "in-tn": ["Chennai"],
  "jp-tyo": ["Tokyo", "Shibuya", "Shinjuku"],
  "jp-os": ["Osaka"],
  "kr-su": ["Seoul", "Gangnam"],
  "kr-bs": ["Busan"],
  "id-jk": ["Jakarta"],
  "id-ba": ["Denpasar", "Ubud"],
  "sa-ru": ["Riyadh"],
  "sa-mk": ["Jeddah", "Mecca"],
  "gb-eng": ["London", "Manchester", "Birmingham", "Leeds"],
  "gb-sct": ["Edinburgh", "Glasgow"],
  "fr-idf": ["Paris"],
  "de-be": ["Berlin"],
  "de-by": ["Munich"],
  "de-nw": ["Cologne", "Düsseldorf"],
  "it-laz": ["Rome"],
  "it-lom": ["Milan"],
  "es-md": ["Madrid"],
  "es-ct": ["Barcelona"],
  "nl-nh": ["Amsterdam"],
  "nl-zh": ["Rotterdam", "The Hague"],
  "us-ca": ["Los Angeles", "San Francisco", "San Diego"],
  "us-ny": ["New York City", "Buffalo"],
  "us-tx": ["Houston", "Austin", "Dallas"],
  "us-fl": ["Miami", "Orlando"],
  "ca-on": ["Toronto", "Ottawa"],
  "ca-qc": ["Montreal", "Quebec City"],
  "ca-bc": ["Vancouver"],
  "mx-cmx": ["Mexico City"],
  "mx-jal": ["Guadalajara"],
  "cu-hav": ["Havana"],
  "jm-kin": ["Kingston"],
  "jm-sj": ["Montego Bay"],
  "cr-sj": ["San José"],
  "br-sp": ["São Paulo"],
  "br-rj": ["Rio de Janeiro"],
  "ar-ba": ["Buenos Aires"],
  "co-cun": ["Bogotá"],
  "co-ant": ["Medellín"],
  "cl-rm": ["Santiago"],
  "pe-lim": ["Lima"],
  "ve-df": ["Caracas"],
  "au-nsw": ["Sydney"],
  "au-vic": ["Melbourne"],
  "au-qld": ["Brisbane"],
  "nz-auk": ["Auckland"],
  "nz-wgn": ["Wellington"],
  "pg-ncd": ["Port Moresby"],
  "fj-cen": ["Suva"],
  "fj-wes": ["Nadi", "Lautoka"],
  "ws-tua": ["Apia"],
  "to-ton": ["Nukuʻalofa"],
}
