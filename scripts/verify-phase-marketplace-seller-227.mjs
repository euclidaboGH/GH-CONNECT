import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const screen=read("components/ghc/marketplace-screen.tsx");
const pkg=JSON.parse(read("package.json"));
const checks=[
 ["release version synchronized", fs.readFileSync("lib/app-release.ts","utf8").includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
 ["seller centre command center",screen.includes("SellerCommandCenter")&&screen.includes("Seller Centre")],
 ["seller attention metric",screen.includes("Needs attention")&&screen.includes("needsAttention")],
 ["seller order management",screen.includes("Manage seller orders")&&screen.includes('setOrderRoleFilter("selling")')],
 ["protected checkout journey",screen.includes("Checkout journey")&&screen.includes("Revalidate")&&screen.includes("Secure order")],
 ["server order checkout retained",screen.includes("socialCreateMarketplaceOrder")],
 ["GHC and Pi rails retained",screen.includes('socialPayMarketplaceOrder(id, "ghc")')&&screen.includes('openPayForListing(')],
 ["trust and reviews retained",screen.includes("sellerTrust")&&screen.includes("sellerReviews")],
 ["canonical cart retained",screen.includes("CartPanel")&&screen.includes("getMarketplaceCart")],
 ["release documentation",fs.existsSync("docs/upgrades/GH_0.227.0_MASSIVE_MARKETPLACE_SELLER_CENTRE_UPGRADE.md")],
];
let pass=0; for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`); if(ok)pass++;}
console.log(`Marketplace Seller Centre upgrade: ${pass}/${checks.length} PASS`); if(pass!==checks.length)process.exit(1);
