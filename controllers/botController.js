const Session = require("../models/Session");
const Order = require("../models/Order");
const {
  sendText, sendButtons, sendList, sendImage,
  sendCatalogueMessage, sendDeliveryFlow,
} = require("../config/whatsapp");
const { getChargeFromPincode, getChargeFromLocation } = require("../config/distanceHelper");

const LOGO_URL = "https://res.cloudinary.com/dxfphwvnf/image/upload/v1781880045/1002297751_u94hqe.jpg";
const t24 = (str) => (str && str.length > 24 ? str.substring(0, 21) + "..." : str || "");

// ═══════════════════════════════════════════════════════════
// CATALOGUE PRICE MAP
// ═══════════════════════════════════════════════════════════
const CATALOGUE_PRICE_MAP = {
  SOUP001:{name:"Hot & Sour Veg Soup",price:80},SOUP002:{name:"Sweet Corn Veg Soup",price:80},
  SOUP003:{name:"Veg Clear Soup",price:80},SOUP004:{name:"Crab Soup",price:120},
  SOUP005:{name:"Hot & Sour Chicken Soup",price:100},SOUP006:{name:"Chicken Clear Soup",price:100},
  START001:{name:"French Fries",price:80},START002:{name:"Gobi 65",price:120},
  START003:{name:"Mushroom 65",price:100},START004:{name:"Paneer Tikka",price:100},
  START005:{name:"Chilly Chicken BL",price:120},START006:{name:"Chicken Tikka",price:150},
  START007:{name:"Chicken 65 BL",price:150},START008:{name:"Chicken 65 WB",price:160},
  START009:{name:"Honey Chicken",price:200},START010:{name:"Chicken Lolly Pop 5pcs",price:150},
  START011:{name:"Dragon Chicken",price:160},START012:{name:"Chicken Kola Urundai",price:200},
  START013:{name:"Alfaham Chicken",price:200},
  GRILL001:{name:"Grill Chicken Full",price:460},GRILL002:{name:"Grill Chicken Half",price:240},
  GRILL003:{name:"Grill Chicken Quarter",price:130},GRILL004:{name:"BBQ Chicken Full",price:480},
  GRILL005:{name:"BBQ Chicken Half",price:250},GRILL006:{name:"BBQ Chicken Quarter",price:130},
  GRILL007:{name:"BBQ Juicy Wings 5pcs",price:200},GRILL008:{name:"BBQ Boneless Strips 5pcs",price:180},
  GRILL009:{name:"BBQ Drumstick 2pcs",price:180},
  TAND001:{name:"Tandoori Chicken Full",price:480},TAND002:{name:"Tandoori Chicken Half",price:250},
  TAND003:{name:"Tandoori Chicken Quarter",price:130},TAND004:{name:"Chicken Tikka 7pcs",price:220},
  TAND005:{name:"Drumstick Chicken 4pcs",price:280},TAND006:{name:"Tandoori Pomfret Fish",price:360},
  TAND007:{name:"Tandoori Platter",price:500},TAND008:{name:"Fish Tikka",price:200},TAND009:{name:"Prawns Tikka",price:200},
  FCHKN001:{name:"Bucket 5pcs",price:450},FCHKN002:{name:"Bucket 10pcs",price:450},
  FCHKN003:{name:"Lolipop 5pcs",price:250},FCHKN004:{name:"Wings 5pcs",price:250},
  FCHKN005:{name:"Boneless Strips 5pcs",price:200},FCHKN006:{name:"Popcorn Chicken",price:160},
  BIRY001:{name:"Mutton Biriyani",price:280},BIRY002:{name:"Chicken Biriyani",price:150},
  BIRY003:{name:"Prawn Biriyani",price:150},BIRY004:{name:"Egg Biriyani",price:120},
  BIRY005:{name:"Plain Biriyani (Kuska)",price:100},
  BUCK001:{name:"Bucket Mutton Full",price:2700},BUCK002:{name:"Bucket Mutton Half",price:1500},
  BUCK003:{name:"Bucket Chicken Full",price:2100},BUCK004:{name:"Bucket Chicken Half",price:1200},
  DRYFRY001:{name:"Gobi Manchurian Dry",price:180},DRYFRY002:{name:"Paneer Manchurian Dry",price:180},
  DRYFRY003:{name:"Mushroom Manchurian Dry",price:180},DRYFRY004:{name:"Mutton Sukka",price:220},
  DRYFRY005:{name:"Karaikudi Chicken Sukka",price:180},DRYFRY006:{name:"Era Thokku",price:200},
  DRYFRY007:{name:"Chettinad Chicken",price:220},DRYFRY008:{name:"Pepper Chicken Dry",price:200},
  DRYFRY009:{name:"Chilly Chicken Dry",price:200},DRYFRY010:{name:"Schezwan Chicken",price:210},
  DRYFRY011:{name:"Egg Pepper Fry",price:120},
  GRAVY001:{name:"Gobi Manchurian Gravy",price:170},GRAVY002:{name:"Paneer Manchurian Gravy",price:180},
  GRAVY003:{name:"Mushroom Manchurian",price:180},GRAVY004:{name:"Veg Kadai",price:180},
  GRAVY005:{name:"Kadai Paneer",price:180},GRAVY006:{name:"Dal Fry",price:180},
  GRAVY007:{name:"Paneer Butter Masala",price:200},GRAVY008:{name:"Aloo Gobi Masala",price:180},
  GRAVY009:{name:"Butter Chicken BL",price:220},GRAVY010:{name:"Chicken Tikka Masala",price:220},
  GRAVY011:{name:"Pepper Chicken Gravy",price:220},GRAVY012:{name:"Chettinad Chicken Gravy",price:220},
  GRAVY013:{name:"Kadai Chicken Gravy",price:220},GRAVY014:{name:"Chicken Manchurian",price:220},
  GRAVY015:{name:"Schezwan Chicken Gravy",price:220},GRAVY016:{name:"Mutton Masala Bone",price:300},
  GRAVY017:{name:"Manchatti Meen Kuzhambu",price:160},
  SEA001:{name:"Nethili Fish Fry",price:160},SEA002:{name:"Vanjaram Fish Masala",price:180},
  SEA003:{name:"Vila Meen Fish Fry",price:160},SEA004:{name:"Vaval Fish Fry",price:250},
  SEA005:{name:"Tawa Vanjaram Fry",price:150},SEA006:{name:"Meen Polichathu",price:250},
  SEA007:{name:"Special Fish Fry",price:300},SEA008:{name:"Boiled Fish 2pcs",price:300},
  SEA009:{name:"Crab Masala",price:300},SEA010:{name:"Squid Masala",price:220},
  SEA011:{name:"Prawns Fry",price:200},SEA012:{name:"Prawns Masala",price:250},
  SEA013:{name:"Prawns Pepper Fry",price:230},SEA014:{name:"Prawns 65",price:220},
  BREAD001:{name:"Chappathi Set",price:50},BREAD002:{name:"Parotta Set",price:50},
  BREAD003:{name:"Veechu Parotta",price:50},BREAD004:{name:"Egg Veechu Parotta",price:70},
  BREAD005:{name:"Egg Kothu Parotta",price:140},BREAD006:{name:"Chicken Kothu Parotta",price:180},
  BREAD007:{name:"Chilly Parotta",price:130},BREAD008:{name:"Ceylon Chicken Parotta",price:150},
  BREAD009:{name:"Naan",price:60},BREAD010:{name:"Butter Naan",price:70},
  BREAD011:{name:"Rotti",price:40},BREAD012:{name:"Butter Rotti",price:50},
  BREAD013:{name:"Pulka 2pcs",price:50},BREAD014:{name:"Kulcha",price:60},
  BREAD015:{name:"Butter Kulcha",price:70},BREAD016:{name:"Garlic Kulcha",price:80},
  NOOD001:{name:"Veg Noodles",price:120},NOOD002:{name:"Egg Noodles",price:140},
  NOOD003:{name:"Fish Noodles",price:180},NOOD004:{name:"Chicken Noodles",price:160},
  NOOD005:{name:"Prawns Noodles",price:200},NOOD006:{name:"Mixed Noodles",price:220},
  NOOD007:{name:"Schezwan Egg Noodles",price:150},NOOD008:{name:"Schezwan Fish Noodles",price:200},
  NOOD009:{name:"Schezwan Chicken Noodles",price:180},
  RICE001:{name:"Veg Fried Rice",price:120},RICE002:{name:"Jeera Fried Rice",price:150},
  RICE003:{name:"Ghee Fried Rice",price:150},RICE004:{name:"Egg Fried Rice",price:140},
  RICE005:{name:"Chicken Fried Rice",price:160},RICE006:{name:"Prawns Fried Rice",price:200},
  RICE007:{name:"Schezwan Egg Fried Rice",price:150},RICE008:{name:"Schezwan Chicken Fried Rice",price:180},
  RICE009:{name:"Schezwan Prawns Fried Rice",price:220},RICE010:{name:"Schezwan Mixed Fried Rice",price:220},
  DOSA001:{name:"Kal Dosa",price:50},DOSA002:{name:"Plain Dosa",price:50},
  DOSA003:{name:"Idiyappam 2pcs",price:30},DOSA004:{name:"Plain Roast",price:60},
  DOSA005:{name:"Ghee Roast",price:70},DOSA006:{name:"Uthappam",price:50},
  DOSA007:{name:"Onion Uthappam",price:70},DOSA008:{name:"Idly 2pcs",price:30},
  DOSA009:{name:"Chicken Curry Uthappam",price:120},DOSA010:{name:"Egg Dosai",price:70},
  MEALS001:{name:"Veg Meals",price:120},MEALS002:{name:"Non Veg Meals",price:140},
  EGG001:{name:"Omelette",price:25},EGG002:{name:"Double Omelette",price:50},
  EGG003:{name:"Half Boil",price:20},EGG004:{name:"Full Boil",price:20},
  EGG005:{name:"Boiled Egg 2pcs",price:40},EGG006:{name:"Masala Kalakki",price:30},
  EGG007:{name:"Egg Burji",price:70},EGG008:{name:"Egg Masala",price:120},
};

const MENU = {
  soup:          {label:"🍲 Soup",items:[{id:"hot_sour_veg_soup",name:"Hot & Sour Veg Soup",price:80},{id:"sweet_corn_veg_soup",name:"Sweet Corn Veg Soup",price:80},{id:"veg_clear_soup",name:"Veg Clear Soup",price:80},{id:"crab_soup",name:"Crab Soup",price:120},{id:"chicken_clear_soup",name:"Chicken Clear Soup",price:100}]},
  starters:      {label:"🍢 Starters",items:[{id:"french_fries",name:"French Fries",price:120},{id:"gobi_65",name:"Gobi 65",price:150},{id:"mushroom_65",name:"Mushroom 65",price:150},{id:"paneer_tikka",name:"Paneer Tikka",price:160},{id:"chilly_chicken_bl",name:"Chilly Chicken (BL)",price:200},{id:"chicken_tikka",name:"Chicken Tikka",price:180},{id:"chicken_65_bl",name:"Chicken 65 (Boneless)",price:200},{id:"chicken_65_wb",name:"Chicken 65 (With Bone)",price:170},{id:"honey_chicken",name:"Honey Chicken",price:220},{id:"chicken_lollipop",name:"Chicken Lollipop 5pcs",price:200},{id:"dragon_chicken",name:"Dragon Chicken",price:200},{id:"chicken_kola_urundai",name:"Chicken Kola Urundai",price:160},{id:"alfaham_chicken",name:"Alfaham Chicken",price:200}]},
  bbq_grill:     {label:"🔥 BBQ / Grill",items:[{id:"grill_full",name:"Grill Chicken Full",price:460},{id:"grill_half",name:"Grill Chicken Half",price:240},{id:"grill_quarter",name:"Grill Chicken Quarter",price:130},{id:"bbq_full",name:"BBQ Chicken Full",price:480},{id:"bbq_half",name:"BBQ Chicken Half",price:250},{id:"bbq_quarter",name:"BBQ Chicken Quarter",price:130},{id:"bbq_wings",name:"BBQ Juicy Wings 5pcs",price:200},{id:"bbq_boneless",name:"BBQ Boneless Strips 5pcs",price:180},{id:"bbq_drumstick",name:"BBQ Drumstick 2pcs",price:180}]},
  tandoori:      {label:"🍗 Tandoori",items:[{id:"tand_full",name:"Tandoori Chicken Full",price:480},{id:"tand_half",name:"Tandoori Chicken Half",price:250},{id:"tand_quarter",name:"Tandoori Chicken Qtr",price:130},{id:"chicken_tikka_7",name:"Chicken Tikka 7pcs",price:480},{id:"drumstick_4pcs",name:"Drumstick Chicken 4pcs",price:280},{id:"tand_pomfret",name:"Tandoori Pomfret Fish",price:360},{id:"tand_platter",name:"Tandoori Platter",price:500},{id:"fish_tikka",name:"Fish Tikka",price:200},{id:"prawns_tikka",name:"Prawns Tikka",price:200}]},
  fried_chicken: {label:"🍗 Fried Chicken",items:[{id:"bucket_5pcs",name:"Bucket 5pcs",price:450},{id:"bucket_10pcs",name:"Bucket 10pcs",price:450},{id:"lolipop_5pcs",name:"Lolipop 5pcs",price:250},{id:"wings_5pcs",name:"Wings 5pcs",price:250},{id:"boneless_strips",name:"Boneless Strips 5pcs",price:200},{id:"popcorn",name:"Popcorn Chicken",price:160}]},
  briyani:       {label:"🍛 Briyani",items:[{id:"mutton_briyani",name:"Mutton Biriyani",price:280},{id:"chicken_briyani",name:"Chicken Biriyani",price:150},{id:"prawn_briyani",name:"Prawn Biriyani",price:150},{id:"egg_briyani",name:"Egg Biriyani",price:120},{id:"plain_briyani",name:"Plain Biriyani (Kuska)",price:100}]},
  bucket_briyani:{label:"🪣 Bucket Briyani",items:[{id:"bucket_mutton_full",name:"Bucket Mutton Full",price:2700},{id:"bucket_mutton_half",name:"Bucket Mutton Half",price:1500},{id:"bucket_chicken_full",name:"Bucket Chicken Full",price:2100},{id:"bucket_chicken_half",name:"Bucket Chicken Half",price:1200}]},
  dry_fry:       {label:"🍖 Dry / Fry",items:[{id:"gobi_man_dry",name:"Gobi Manchurian Dry",price:180},{id:"paneer_man_dry",name:"Paneer Manchurian Dry",price:180},{id:"mushroom_man_dry",name:"Mushroom Manchurian Dry",price:180},{id:"mutton_sukka",name:"Mutton Sukka",price:220},{id:"karaikudi_sukka",name:"Karaikudi Chicken Sukka",price:180},{id:"era_thokku",name:"Era Thokku",price:200},{id:"chicken_chettinad",name:"Chettinad Chicken",price:220},{id:"pepper_chkn_dry",name:"Pepper Chicken Dry",price:200},{id:"chilly_chkn_dry",name:"Chilly Chicken Dry",price:200},{id:"schezwan_chicken",name:"Schezwan Chicken",price:210},{id:"egg_pepper_fry",name:"Egg Pepper Fry",price:120}]},
  gravy:         {label:"🫕 Gravy",items:[{id:"gobi_man_gravy",name:"Gobi Manchurian Gravy",price:170},{id:"paneer_man_gravy",name:"Paneer Manchurian Gravy",price:180},{id:"mushroom_man_gravy",name:"Mushroom Manchurian",price:180},{id:"veg_kadai",name:"Veg Kadai",price:180},{id:"kadai_paneer",name:"Kadai Paneer",price:180},{id:"dal_fry",name:"Dal Fry",price:180},{id:"paneer_butter",name:"Paneer Butter Masala",price:200},{id:"aloo_gobi",name:"Aloo Gobi Masala",price:180},{id:"butter_chicken",name:"Butter Chicken BL",price:220},{id:"chicken_tikka_masala",name:"Chicken Tikka Masala",price:220},{id:"pepper_chkn_gravy",name:"Pepper Chicken Gravy",price:220},{id:"chettinad_gravy",name:"Chettinad Chicken",price:220},{id:"kadai_chicken",name:"Kadai Chicken Gravy",price:220},{id:"chicken_man_gravy",name:"Chicken Manchurian",price:220},{id:"schezwan_chkn_gravy",name:"Schezwan Chicken Gravy",price:220},{id:"mutton_masala",name:"Mutton Masala Bone",price:300},{id:"manchatti_meen",name:"Manchatti Meen Kuzhambu",price:160}]},
  seafoods:      {label:"🦞 Seafoods",items:[{id:"nethili_fry",name:"Nethili Fish Fry",price:160},{id:"vanjaram_masala",name:"Vanjaram Fish Masala",price:180},{id:"vila_meen_fry",name:"Vila Meen Fish Fry",price:160},{id:"vaval_fry",name:"Vaval Fish Fry",price:250},{id:"tawa_vanjaram",name:"Tawa Vanjaram Fry",price:150},{id:"meen_polichathu",name:"Meen Polichathu",price:250},{id:"special_fish",name:"Special Fish Fry",price:300},{id:"boiled_fish",name:"Boiled Fish (2 Fish)",price:300},{id:"crab_masala",name:"Crab Masala",price:300},{id:"squid_masala",name:"Squid Masala",price:220},{id:"prawns_fry",name:"Prawns Fry",price:200},{id:"prawns_masala",name:"Prawns Masala",price:250},{id:"prawns_pepper",name:"Prawns Pepper Fry",price:230},{id:"prawns_65",name:"Prawns 65",price:220}]},
  indian_breads: {label:"🫓 Indian Breads",items:[{id:"chappathi",name:"Chappathi Set",price:50},{id:"parotta",name:"Parotta Set",price:50},{id:"veechu_parotta",name:"Veechu Parotta",price:50},{id:"egg_veechu",name:"Egg Veechu Parotta",price:70},{id:"egg_kothu",name:"Egg Kothu Parotta",price:140},{id:"chicken_kothu",name:"Chicken Kothu Parotta",price:180},{id:"chilly_parotta",name:"Chilly Parotta",price:130},{id:"ceylon_parotta",name:"Ceylon Chicken Parotta",price:150},{id:"naan",name:"Naan",price:60},{id:"butter_naan",name:"Butter Naan",price:70},{id:"rotti",name:"Rotti",price:40},{id:"butter_rotti",name:"Butter Rotti",price:50},{id:"pulka",name:"Pulka (2pcs)",price:50},{id:"kulcha",name:"Kulcha",price:60},{id:"butter_kulcha",name:"Butter Kulcha",price:70},{id:"garlic_naan",name:"Garlic Naan",price:80}]},
  noodles:       {label:"🍜 Noodles",items:[{id:"veg_noodles",name:"Veg Noodles",price:120},{id:"egg_noodles",name:"Egg Noodles",price:140},{id:"chicken_noodles",name:"Chicken Noodles",price:160},{id:"fish_noodles",name:"Fish Noodles",price:180},{id:"prawns_noodles",name:"Prawns Noodles",price:200},{id:"mixed_noodles",name:"Mixed Noodles",price:220},{id:"sch_egg_noodles",name:"Schezwan Egg Noodles",price:150},{id:"sch_fish_noodles",name:"Schezwan Fish Noodles",price:200},{id:"sch_chkn_noodles",name:"Schezwan Chicken Noodles",price:180}]},
  fried_rice:    {label:"🍚 Fried Rice",items:[{id:"veg_rice",name:"Veg Fried Rice",price:120},{id:"jeera_rice",name:"Jeera Fried Rice",price:150},{id:"ghee_rice",name:"Ghee Fried Rice",price:150},{id:"egg_rice",name:"Egg Fried Rice",price:140},{id:"chicken_rice",name:"Chicken Fried Rice",price:160},{id:"prawns_rice",name:"Prawns Fried Rice",price:200},{id:"sch_egg_rice",name:"Schezwan Egg Fried Rice",price:150},{id:"sch_chkn_rice",name:"Schezwan Chicken Rice",price:180},{id:"sch_prwn_rice",name:"Schezwan Prawns Rice",price:220},{id:"sch_mixed_rice",name:"Schezwan Mixed Fried Rice",price:220}]},
  tiffin:        {label:"🥞 Tiffin",items:[{id:"kal_dosa",name:"Kal Dosa",price:50},{id:"plain_dosa",name:"Plain Dosa",price:50},{id:"ghee_roast",name:"Ghee Roast",price:70},{id:"plain_roast",name:"Plain Roast",price:60},{id:"uthappam",name:"Uthappam",price:50},{id:"onion_uthappam",name:"Onion Uthappam",price:70},{id:"egg_dosai",name:"Egg Dosai",price:70},{id:"idly",name:"Idly (2pcs)",price:30},{id:"idiyappam",name:"Idiyappam (2pcs)",price:30},{id:"chicken_uthappam",name:"Chicken Curry Uthappam",price:120}]},
  meals:         {label:"🍽️ Meals",items:[{id:"veg_meals",name:"Veg Meals",price:120},{id:"non_veg_meals",name:"Non Veg Meals",price:140}]},
  eggies:        {label:"🥚 Eggies",items:[{id:"omelette",name:"Omelette",price:25},{id:"double_omelette",name:"Double Omelette",price:50},{id:"half_boil",name:"Half Boil",price:20},{id:"full_boil",name:"Full Boil",price:20},{id:"boiled_egg",name:"Boiled Egg 2pcs",price:40},{id:"masala_kalakki",name:"Masala Kalakki",price:30},{id:"egg_burji",name:"Egg Burji",price:70},{id:"egg_masala",name:"Egg Masala",price:120}]},
};

const ALL_ITEMS = [];
for (const [catKey,cat] of Object.entries(MENU)) {
  for (const item of cat.items) ALL_ITEMS.push({...item,catKey,catLabel:cat.label});
}

function findItem(id) {
  for (const cat of Object.values(MENU)) {
    const item = cat.items.find(i=>i.id===id);
    if (item) return item;
  }
  return null;
}

function normalizeQuery(str) {
  return str.toLowerCase().trim()
    .replace(/biryani|briyani|bryani/g,"biriyani")
    .replace(/noodle$/g,"noodles").replace(/prawn$/g,"prawns")
    .replace(/chiken/g,"chicken").replace(/muttan/g,"mutton");
}

function searchItems(query) {
  const q = normalizeQuery(query);
  return ALL_ITEMS.filter(item => {
    const name = normalizeQuery(item.name);
    const cat  = normalizeQuery(item.catLabel);
    const words = q.split(" ").filter(w=>w.length>2);
    return name.includes(q)||cat.includes(q)||words.some(w=>name.includes(w));
  }).slice(0,9);
}

function buildCartMsg(cart) {
  if (!cart||cart.length===0) return "🛒 Your cart is empty!";
  let msg = "🛒 *Your Cart*\n─────────────────\n";
  cart.forEach((item,i)=>{
    msg += `${i+1}. ${item.name}\n   ${item.qty} × Rs.${item.price} = Rs.${item.price*item.qty}\n`;
  });
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  msg += `─────────────────\n💰 *Total: Rs.${total}*`;
  return msg;
}

function buildCartSummary(cart) {
  return cart.map(i=>`${i.name} x${i.qty}`).join(", ");
}

function normalizePhone(phone) {
  const c = (phone||"").replace(/^\+?91/,"").replace(/\D/g,"").slice(-10);
  return c.length===10?c:"9999999999";
}

const GST_PERCENT = 5;
const ADDON_PRICES_MAP = {
  raita:{name:"Raita",price:30},pickle:{name:"Pickle",price:20},
  papad:{name:"Papad",price:20},extra_gravy:{name:"Extra Gravy",price:50},
  salad:{name:"Salad",price:40},curd_rice:{name:"Curd Rice",price:60},
  sweet:{name:"Sweet (Kheer)",price:50},
};
const CELEBRATION_MAP = {
  birthday:"🎂 Birthday Decoration",anniversary:"💑 Anniversary Setup",
  cake:"🎂 Cake Arrangement",flowers:"💐 Flower Bouquet",
  candle:"🕯️ Candle Light Dinner",board:"🪧 Welcome Board",photo:"📸 Photography",
};
const SEATING_MAP = {
  ac:"❄️ AC Hall",non_ac:"🌿 Non-AC",family_hall:"👨‍👩‍👧 Family Hall",outdoor:"🌳 Outdoor",
};

// ═══════════════════════════════════════════════════════════
// SEND WELCOME
// ═══════════════════════════════════════════════════════════
async function sendWelcome(to, name="") {
  const greet = name ? `👋 Hello ${name}!` : "👋 Welcome!";
  await sendImage(to, LOGO_URL,
    `🍛 *Kavi Chettinadu Restaurant*\n✨ _Taste The Tradition_\n\n${greet}\n\n🏆 Authentic Chettinad Cuisine\n📍 Rameswaram | ⏰ 12PM – 10:30PM`
  );
  await sendButtons(to,
    "🍽️ What would you like today?",
    [{id:"GET_STARTED", title:"🍴 Explore Now"}]
  );
}

// ── Menu helpers ──────────────────────────────────────────
async function sendMainMenu(to, page=0) {
  const allCats = Object.entries(MENU);
  const PAGE_SIZE=9, start=page*PAGE_SIZE;
  const pageCats = allCats.slice(start,start+PAGE_SIZE);
  const hasMore = allCats.length>start+PAGE_SIZE;
  const rows = pageCats.map(([key,cat])=>({id:`CAT_${key}`,title:t24(cat.label),description:`${cat.items.length} items`}));
  if (hasMore) rows.push({id:`MENU_PAGE_${page+1}`,title:"➡️ More",description:"See more"});
  if (page>0)  rows.push({id:`MENU_PAGE_${page-1}`,title:"⬅️ Previous",description:"Go back"});
  await sendList(to,"🍽️ Kavi Chettinadu","Select a category:","Browse Menu",[{title:"Menu Categories",rows}]);
}

async function sendCategoryItems(to, catKey, page=0) {
  const cat=MENU[catKey]; if (!cat) return;
  const PAGE_SIZE=9, start=page*PAGE_SIZE;
  const pageItems=cat.items.slice(start,start+PAGE_SIZE);
  const hasMore=cat.items.length>start+PAGE_SIZE;
  const rows=pageItems.map(item=>({id:`ITEM_${item.id}`,title:t24(item.name),description:`Rs.${item.price}`}));
  if (hasMore) rows.push({id:`MORE_${catKey}_${page+1}`,title:"➡️ More Items",description:"See more"});
  if (page>0)  rows.push({id:`MORE_${catKey}_${page-1}`,title:"⬅️ Previous",description:"Go back"});
  await sendList(to,t24(cat.label),"Select an item:","Choose Item",[{title:t24(cat.label),rows}]);
}

async function sendQuantitySelect(to, item) {
  await sendText(to,`*${item.name}*\n💰 Price: Rs.${item.price}\n\n📝 *Enter quantity:*\nType a number and send!`);
  await sendButtons(to,"Or tap quick option:",[
    {id:`QTY_1___${item.id}`,title:"1️⃣  Qty: 1"},
    {id:`QTY_2___${item.id}`,title:"2️⃣  Qty: 2"},
    {id:`QTY_3___${item.id}`,title:"3️⃣  Qty: 3"},
  ]);
}

async function sendAfterAddToCart(to, cart) {
  const total=cart.reduce((s,i)=>s+i.price*i.qty,0);
  await sendButtons(to,
    `✅ Added! 🛒 *Rs.${total}*`,
    [{id:"ADD_MORE",title:"➕ Add More"},{id:"VIEW_CART",title:"🛒 View Cart"},{id:"PLACE_ORDER",title:"✅ Place Order"}]
  );
}

async function generateRazorpayLink(session, from, type="upi") {
  const total=session.deliveryData?.grand_total||0;
  const expiry=type==="upi"?1800:3600;
  try {
    const Razorpay=require("razorpay");
    const rzp=new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});
    const payLink=await rzp.paymentLink.create({
      amount:total*100,currency:"INR",
      description:`Kavi Chettinadu - ${session.deliveryData?.name||"Customer"}`,
      customer:{name:session.deliveryData?.name||"Customer",contact:normalizePhone(session.deliveryData?.phone||from)},
      notify:{sms:false,email:false},
      expire_by:Math.floor(Date.now()/1000)+expiry,
      reminder_enable:false,
    });
    console.log("✅ Razorpay link:",payLink.short_url);
    return payLink.short_url;
  } catch(err) {
    console.error("❌ Razorpay error:",JSON.stringify(err));
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// PLACE ORDER
// ═══════════════════════════════════════════════════════════
async function placeOrder(from, session) {
  const orderType = session.deliveryData?.order_type || "";
  // Dine In: grand_total can be 0 (no food order, just table booking)
  if (!orderType && !session.deliveryData?.grand_total) {
    await sendButtons(from,"❌ *Order details missing!*\n\nPlease start again.",[
      {id:"hi",title:"🍴 Start Over"},
    ]);
    return;
  }

  const {
    name,phone,alternate_phone,address,order_type,paymentMethod,
    addons,addon_total,delivery_charge,gst_amount,grand_total,
    table_persons,table_date,table_time,table_seating,seating_label,
    pickup_date,pickup_time,special_instructions,
    celebration_addons,occasion_name,distance_info,
  } = session.deliveryData;

  const cartTotal  = session.cart.reduce((s,i)=>s+i.price*i.qty,0);
  const addonItems = (addons||[]).map(a=>({name:a.name,price:a.price,quantity:1}));
  const addonTotal = addon_total||0;
  const isDelivery = order_type==="delivery";
  const delCharge  = delivery_charge??0;
  const gst        = gst_amount??0;
  const finalTotal = grand_total||(cartTotal+addonTotal+delCharge+gst);
  // Generate booking/order ID
  const prefix  = order_type==="dine_in" ? "BKG" : "KAV";
  const orderId = prefix + Date.now();

  const orderTypeLabel =
    order_type==="delivery"?"🚚 Home Delivery":
    order_type==="takeaway"?"🥡 Take Away":"🍽️ Dine In";

  const payLabel =
    paymentMethod==="PAY_COD" ?"Cash on Delivery":
    paymentMethod==="PAY_UPI" ?"UPI":
    paymentMethod==="PAY_REST"?"Pay at Restaurant":"Card";

  const celebText = (celebration_addons||[]).map(id=>CELEBRATION_MAP[id]||id).filter(Boolean).join(", ");
  const seatLabel = SEATING_MAP[table_seating]||table_seating||"";

  const tableInfo =
    order_type==="dine_in"&&table_persons
      ? `\n👥 Guests: ${table_persons} | 📅 ${table_date} | 🕐 ${table_time} | 🪑 ${seatLabel}`+
        (occasion_name?`\n🎉 Occasion: ${occasion_name}`:"")+
        (celebText?`\n🎊 Arrangements: ${celebText}`:"")
      : order_type==="takeaway"
      ? `\n📅 Date: ${pickup_date||""} | 🕐 Pickup: ${pickup_time||"ASAP"}`
      : "";

  const allItems=[
    ...session.cart.map(i=>({name:i.name,price:i.price,quantity:i.qty})),
    ...addonItems,
  ];

  const newOrder=new Order({
    orderId,phone:phone||from,name:name||"Customer",
    address:address||orderTypeLabel,items:allItems,
    totalAmount:finalTotal,paymentMethod:payLabel,
    status:"confirmed",orderType:order_type||"delivery",
    notes:special_instructions||"",
  });
  await newOrder.save();
  console.log(`✅ Order: ${orderId} | Total: Rs.${finalTotal}`);

  session.cart=[];session.deliveryData={};session.deliveryStep=null;
  session.preSelectedOrderType=null;session.state="WELCOME";
  session.markModified("cart");session.markModified("deliveryData");
  await session.save();

  const itemsList=allItems.map(i=>`• ${i.name} × ${i.quantity} = Rs.${i.price*i.quantity}`).join("\n");
  const delivLabel=isDelivery?`Rs.${delCharge} (${distance_info||""})` :"Free";

  const confirmHeader = order_type==="dine_in"
    ? `🎉 *Table Booked Successfully!*\n`
    : `✅ *Order Confirmed!*\n`;

  await sendButtons(from,
    confirmHeader+
    `📋 *${order_type==="dine_in"?"Booking":"Order"} ID:* #${orderId}\n`+
    `─────────────────\n`+
    `🛒 *Items:*\n${itemsList}\n`+
    `─────────────────\n`+
    (cartTotal>0?`🛒 *Food Total:* Rs.${cartTotal}\n`:"")+
    (addonTotal>0?`🍱 *Add-ons:* Rs.${addonTotal}\n`:"")+
    (isDelivery?`🚚 *Delivery:* ${delivLabel}\n`:"")+
    `📊 *GST (5%):* Rs.${gst}\n`+
    `─────────────────\n`+
    `💰 *Grand Total: Rs.${finalTotal}*\n`+
    `💳 *Payment:* ${payLabel}\n`+
    `🚚 *Type:* ${orderTypeLabel}${tableInfo}\n`+
    `📍 *Address:* ${address||orderTypeLabel}\n`+
    `─────────────────\n`+
    `⏱️ *Est. Time:* 30–45 mins\n\n`+
    `Thank you! 🍛 *Kavi Chettinadu* 🙏\n📞 95859 60612`,
    [{id:"VIEW_CATALOGUE",title:"🔄 Order Again"},{id:"exit",title:"❌ Exit"}]
  );
}

async function handleCatalogueOrder(from, session, catalogueOrder) {
  const items=catalogueOrder?.product_items||[];
  for (const item of items) {
    const rid=item.product_retailer_id;
    const cItem=CATALOGUE_PRICE_MAP[rid];
    const idx=session.cart.findIndex(c=>c.itemId===rid);
    if (idx>=0) {session.cart[idx].qty+=item.quantity||1;}
    else {session.cart.push({itemId:rid,name:cItem?.name||rid,price:cItem?.price||0,qty:item.quantity||1});}
    if (!cItem) console.warn(`⚠️ Not in price map: ${rid}`);
  }
  session.markModified("cart");
  await session.save();
  await sendButtons(from,
    `${buildCartMsg(session.cart)}`,
    [{id:"PLACE_ORDER",title:"✅ Place Order"},{id:"VIEW_CATALOGUE",title:"🖼️ More Items"},{id:"CLEAR_CART",title:"🗑️ Clear Cart"}]
  );
}

// ═══════════════════════════════════════════════════════════
// BROWSE MENU HELPERS
// ═══════════════════════════════════════════════════════════
async function showBrowseOptions(from) {
  await sendButtons(from,
    "📋 *Browse our menu:*",
    [{id:"VIEW_CATALOGUE",title:"🖼️ View Catalogue"},{id:"BROWSE_MENU",title:"📋 Browse Menu"},{id:"search",title:"🔍 Search Dish"}]
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════
const handleMessage = async (from, messageBody, interactiveReply, locationData, catalogueOrder, contactName="") => {
  try {
    let session = await Session.findOne({phoneNumber:from});
    if (!session) {
      session = new Session({phoneNumber:from,state:"WELCOME",cart:[]});
      await session.save();
    }
    if (!session.cart) session.cart=[];
    if (!session.deliveryData) session.deliveryData={};
    session.lastActivity=new Date();

    // Save WhatsApp name
    if (contactName&&!session.whatsappName) {
      session.whatsappName=contactName;
      session.markModified("whatsappName");
      await session.save();
    }

    const input    = interactiveReply?.id||messageBody?.trim()?.toLowerCase();
    const rawInput = messageBody?.trim();
    console.log(`📥 From: ${from} | Input: ${input} | State: ${session.state}`);

    // ── CATALOGUE ORDER ───────────────────────────────────
    if (catalogueOrder) {await handleCatalogueOrder(from,session,catalogueOrder);return;}

    // ── LOCATION SHARED ───────────────────────────────────
    if (locationData) {
      const mapsUrl=`https://maps.google.com/?q=${locationData.lat},${locationData.lng}`;
      const address=locationData.address||mapsUrl;
      if (session.state==="AWAITING_LOCATION") {
        const dist=getChargeFromLocation(locationData.lat,locationData.lng);
        session.deliveryData={
          live_location:address,
          live_location_coords:{lat:locationData.lat,lng:locationData.lng},
          delivery_charge:dist.charge,
          distance_info:`📍 Live (${dist.km}km)`,
        };
        session.preSelectedOrderType = "delivery";
        session.markModified("deliveryData");
        session.markModified("preSelectedOrderType");
        if (session.cart&&session.cart.length>0) {
          session.state="AWAITING_FLOW";
          await session.save();
          const cartSummary=buildCartSummary(session.cart);
          const total=session.cart.reduce((s,i)=>s+i.price*i.qty,0);
          await sendText(from,`✅ *Location received!*\n📍 ${address}\n🚚 ~${dist.km}km | Delivery: Rs.${dist.charge}\n\nOpening order form...`);
          await sendDeliveryFlow(from,cartSummary,`Rs.${total}`,"delivery");
        } else {
          session.state="CATALOGUE";
          await session.save();
          await sendText(from,`✅ *Location received!*\n📍 ${address}\n🚚 ~${dist.km}km | Delivery: Rs.${dist.charge}\n\nNow add items to your cart:`);
          await showBrowseOptions(from);
        }
      } else {
        await sendText(from,`📍 Location received!\n${mapsUrl}\n\nSend *hi* to start ordering.`);
      }
      return;
    }

    // ── EXIT ──────────────────────────────────────────────
    if (["exit","bye","quit"].includes(input)) {
      session.state="WELCOME";session.cart=[];session.deliveryData={};
      session.preSelectedOrderType=null;
      session.markModified("cart");session.markModified("deliveryData");
      await session.save();
      await sendText(from,"👋 Thank you! Visit again soon 🍛\nSend *hi* to order anytime!");
      return;
    }

    // ── GREETING ──────────────────────────────────────────
    if (["hi","hello","hey","start","menu","/menu","/start"].includes(input)) {
      session.state="MAIN_MENU";session.cart=[];session.deliveryData={};
      session.preSelectedOrderType=null;
      session.markModified("cart");session.markModified("deliveryData");
      await session.save();
      await sendWelcome(from,session.whatsappName||contactName||"");
      return;
    }

    // ── GET STARTED ───────────────────────────────────────
    if (input==="GET_STARTED"||input==="EXPLORE_MENUS") {
      session.state="MAIN_MENU";
      await session.save();
      await sendList(from,
        "🍛 Kavi Chettinadu",
        "How can we serve you today? 🙏",
        "Choose",
        [{
          title:"Order Options",
          rows:[
            {id:"ORDER_DELIVERY",title:"🚚 Home Delivery",description:"Doorstep delivery"},
            {id:"ORDER_TAKEAWAY",title:"🥡 Take Away",    description:"Pickup at restaurant"},
            {id:"ORDER_DINEIN",  title:"🍽️ Dine In",      description:"Book a table"},
            {id:"BROWSE_MENU",   title:"📋 Browse Menu",  description:"View full menu"},
            {id:"exit",          title:"❌ Exit",           description:"Bye!"},
          ]
        }]
      );
      return;
    }

    // ══════════════════════════════════════════════════════
    // ORDER TYPE HANDLERS
    // ══════════════════════════════════════════════════════

    // ── 🚚 HOME DELIVERY → catalogue first, details in flow ─
    if (input==="ORDER_DELIVERY") {
      session.preSelectedOrderType="delivery";
      session.state="CATALOGUE";
      session.deliveryData={};
      session.markModified("preSelectedOrderType");
      session.markModified("deliveryData");
      await session.save();
      await sendText(from,"🚚 *Home Delivery* — Add items to cart:");
      await showBrowseOptions(from);
      return;
    }

    // ── 🥡 TAKEAWAY → browse menu first ──────────────────
    if (input==="ORDER_TAKEAWAY") {
      session.preSelectedOrderType="takeaway";
      session.state="CATALOGUE";
      session.deliveryData={};
      session.markModified("preSelectedOrderType");
      session.markModified("deliveryData");
      await session.save();
      await sendText(from,"🥡 *Take Away* — Add items to cart:");
      await showBrowseOptions(from);
      return;
    }

    // ── 🍽️ DINE IN → flow directly (NO browse needed) ────
    if (input==="ORDER_DINEIN") {
      session.preSelectedOrderType="dine_in";
      session.state="AWAITING_FLOW";
      session.deliveryData={};
      session.cart=[];
      session.markModified("preSelectedOrderType");
      session.markModified("deliveryData");
      session.markModified("cart");
      await session.save();
      await sendText(from,"🍽️ *Dine In* — Fill booking details:");
      await sendDeliveryFlow(from,"Table Booking",0);
      return;
    }

    // ── 📍 SHARE LOCATION ────────────────────────────────
    if (input==="SHARE_LOCATION") {
      session.state="AWAITING_LOCATION";
      await session.save();
      await sendText(from,
        "📍 *Share your live location:*\n\n"+
        "Tap the 📎 *attachment icon* → *Location* → *Send your current location*\n\n"+
        "We will calculate delivery charge automatically! 🚚"
      );
      await sendButtons(from,"Or tap below to type address instead:",[
        {id:"SKIP_LOCATION",title:"✏️ Type Address Instead"},
      ]);
      return;
    }

    // ── ✏️ SKIP LOCATION → manual address in form ────────
    if (input==="SKIP_LOCATION") {
      session.deliveryData={...session.deliveryData,live_location:""};
      session.markModified("deliveryData");
      if (session.cart&&session.cart.length>0) {
        // Cart ready → open flow
        session.state="AWAITING_FLOW";
        await session.save();
        const cartSummary=buildCartSummary(session.cart);
        const total=session.cart.reduce((s,i)=>s+i.price*i.qty,0);
        await sendDeliveryFlow(from,cartSummary,total);
      } else {
        // No cart → browse first
        session.state="CATALOGUE";
        await session.save();
        await sendText(from,"🚚 *Home Delivery selected!*\n\nAdd items to your cart:");
        await showBrowseOptions(from);
      }
      return;
    }

    // ── VIEW CATALOGUE ────────────────────────────────────
    if (input==="VIEW_CATALOGUE") {
      session.state="CATALOGUE";
      await session.save();
      const sent=await sendCatalogueMessage(from);
      if (!sent) {session.state="CATEGORY_SELECT";await session.save();await sendMainMenu(from,0);}
      return;
    }

    // ── SEARCH ────────────────────────────────────────────
    if (["search","/search"].includes(input)) {
      session.state="SEARCHING";
      await session.save();
      await sendText(from,"🔍 Type dish name to search\n_e.g. chicken, biryani, naan_");
      return;
    }

    if (session.state==="SEARCHING"&&rawInput&&!rawInput.startsWith("/")&&input!=="__FLOW_COMPLETE__") {
      const results=searchItems(rawInput);
      if (results.length===0) {
        await sendButtons(from,`❌ No results for "*${rawInput}*"\n\nTry another name!`,[
          {id:"search",title:"🔍 Search Again"},{id:"BROWSE_MENU",title:"📋 Browse Menu"},{id:"exit",title:"❌ Exit"},
        ]);
        return;
      }
      const rows=results.map(item=>({id:`ITEM_${item.id}`,title:t24(item.name),description:`Rs.${item.price} | ${t24(item.catLabel)}`}));
      await sendList(from,"🔍 Search Results",`Found ${results.length} item(s) for "${rawInput}":`,
        "View Items",[{title:"Results",rows}]);
      session.state="ITEM_SELECT";await session.save();
      return;
    }

    // ── CONTACT ───────────────────────────────────────────
    if (["contact us","contact","/contact"].includes(input)) {
      await sendButtons(from,
        `📞 *Kavi Chettinadu*\n📍 Rameswaram - 623526\n\n📞 95859 60612\n📞 95859 60613\n⏰ 12PM – 10:30PM\n🌐 kavirestaurant.in`,
        [{id:"VIEW_CATALOGUE",title:"🖼️ View Catalogue"},{id:"BROWSE_MENU",title:"📋 Browse Menu"},{id:"exit",title:"❌ Exit"}]
      );
      return;
    }

    // ── BROWSE MENU ───────────────────────────────────────
    if (["BROWSE_MENU","ADD_MORE","MAIN_MENU","browse_menu"].includes(input)) {
      session.state="CATEGORY_SELECT";await session.save();await sendMainMenu(from,0);return;
    }
    if (input?.startsWith("MENU_PAGE_")) {
      const page=parseInt(input.replace("MENU_PAGE_",""));
      session.state="CATEGORY_SELECT";await session.save();await sendMainMenu(from,page);return;
    }

    // ── CATEGORY ──────────────────────────────────────────
    if (input?.startsWith("CAT_")) {
      const catKey=input.replace("CAT_","");
      session.currentCategory=catKey;session.state="ITEM_SELECT";
      await session.save();await sendCategoryItems(from,catKey,0);return;
    }
    if (input?.startsWith("MORE_")) {
      const parts=input.split("_");
      const page=parseInt(parts[parts.length-1]);
      const catKey=parts.slice(1,parts.length-1).join("_");
      session.currentCategory=catKey;await session.save();await sendCategoryItems(from,catKey,page);return;
    }

    // ── ITEM SELECT ───────────────────────────────────────
    if (input?.startsWith("ITEM_")) {
      const itemId=input.replace("ITEM_","");
      const item=findItem(itemId);
      if (!item) {await sendText(from,"❌ Item not found.");return;}
      session.pendingItem={id:item.id,name:item.name,price:item.price};
      session.state="QUANTITY_SELECT";session.markModified("pendingItem");
      await session.save();await sendQuantitySelect(from,item);return;
    }

    // ── MANUAL QUANTITY ───────────────────────────────────
    if (session.state==="QUANTITY_SELECT"&&session.pendingItem&&rawInput&&/^\d+$/.test(rawInput)) {
      const qty=parseInt(rawInput);
      if (qty<1||qty>20) {await sendText(from,"⚠️ Enter quantity between 1 and 20.");return;}
      const item=session.pendingItem;
      const idx=session.cart.findIndex(c=>c.itemId===item.id);
      if (idx>=0) {session.cart[idx].qty+=qty;}
      else {session.cart.push({itemId:item.id,name:item.name,price:item.price,qty});}
      session.pendingItem=null;session.state="CART";session.markModified("cart");
      await session.save();await sendAfterAddToCart(from,session.cart);return;
    }

    // ── QTY BUTTON ────────────────────────────────────────
    if (input?.startsWith("QTY_")) {
      const wp=input.replace("QTY_","");
      const sep=wp.indexOf("___");
      const qty=parseInt(wp.substring(0,sep));
      const itemId=wp.substring(sep+3);
      const item=findItem(itemId)||session.pendingItem;
      if (!item) {await sendText(from,"❌ Error. Try again.");return;}
      const idx=session.cart.findIndex(c=>c.itemId===item.id);
      if (idx>=0) {session.cart[idx].qty+=qty;}
      else {session.cart.push({itemId:item.id,name:item.name,price:item.price,qty});}
      session.pendingItem=null;session.state="CART";session.markModified("cart");
      await session.save();await sendAfterAddToCart(from,session.cart);return;
    }

    // ── VIEW CART ─────────────────────────────────────────
    if (["VIEW_CART","/cart"].includes(input)) {
      const cartMsg=buildCartMsg(session.cart);
      if (!session.cart||session.cart.length===0) {
        await sendButtons(from,cartMsg,[{id:"VIEW_CATALOGUE",title:"🖼️ View Catalogue"},{id:"BROWSE_MENU",title:"📋 Browse Menu"}]);
      } else {
        await sendButtons(from,cartMsg,[{id:"ADD_MORE",title:"➕ Add More"},{id:"PLACE_ORDER",title:"✅ Place Order"},{id:"CLEAR_CART",title:"🗑️ Clear Cart"}]);
      }
      return;
    }

    // ── CLEAR CART ────────────────────────────────────────
    if (input==="CLEAR_CART") {
      session.cart=[];session.markModified("cart");await session.save();
      await sendButtons(from,"🗑️ Cart cleared!",[{id:"VIEW_CATALOGUE",title:"🖼️ View Catalogue"},{id:"BROWSE_MENU",title:"📋 Browse Menu"}]);
      return;
    }

    // ── PLACE ORDER → open flow directly ────────────────
    if (["PLACE_ORDER","PLACE_ORDER_FLOW","/order"].includes(input)) {
      if (!session.cart||session.cart.length===0) {
        await sendButtons(from,"❌ Your cart is empty!",[{id:"VIEW_CATALOGUE",title:"🖼️ View Catalogue"},{id:"BROWSE_MENU",title:"📋 Browse Menu"}]);
        return;
      }
      console.log(`🎯 PLACE_ORDER | preSelectedType: ${session.preSelectedOrderType}`);
      session.state="AWAITING_FLOW";await session.save();
      const cartSummary=buildCartSummary(session.cart);
      const total=session.cart.reduce((s,i)=>s+i.price*i.qty,0);
      const pType=session.preSelectedOrderType||"";
      await sendDeliveryFlow(from,cartSummary,`Rs.${total}`,pType);
      return;
    }

    // ── FLOW COMPLETE ─────────────────────────────────────
    if (input==="__FLOW_COMPLETE__") {
      if (session.state!=="AWAITING_FLOW") {
        console.log("⚠️ Stale flow ignored | State:",session.state);
        return;
      }
      const flowData=interactiveReply?.flowData||{};
      console.log("✅ Flow complete:",JSON.stringify(flowData,null,2));

      const {
        order_type,customer_name,customer_phone,alternate_phone,
        delivery_address,pincode,live_location_address,
        selected_addons,special_instructions,
        table_persons,table_date,table_time,table_seating,
        celebration_addons,occasion_name,pickup_date,pickup_time,
      } = flowData;

      // Delivery charge
      let deliveryCharge=0,distanceInfo="";
      if (order_type==="delivery") {
        const liveCoords=session.deliveryData?.live_location_coords;
        let distResult;
        if (liveCoords) {
          distResult=getChargeFromLocation(liveCoords.lat,liveCoords.lng);
          distanceInfo=`📍 Live Location (${distResult.km}km)`;
        } else if (pincode) {
          distResult=getChargeFromPincode(pincode);
          distanceInfo=`📮 ${distResult.area||pincode} (${distResult.km}km)`;
        } else {
          distResult={km:3,charge:40};distanceInfo="📍 Address provided";
        }
        deliveryCharge=distResult.charge;
      }

      const liveAddr=live_location_address||session.deliveryData?.live_location||"";
      const full_address=
        order_type==="delivery"
          ? liveAddr
            ? `${delivery_address?delivery_address+", ":""}📍 ${liveAddr}${pincode?" - "+pincode:""}`
            : [delivery_address,pincode?`- ${pincode}`:null].filter(Boolean).join(" ")
          : order_type==="takeaway"
          ? `Take Away | ${pickup_date||""} ${pickup_time||"ASAP"}`
          : "Dine In";

      const cartTotal=session.cart.reduce((s,i)=>s+i.price*i.qty,0);
      const addonList=Array.isArray(selected_addons)?selected_addons:[];
      const addonItems=addonList.map(id=>ADDON_PRICES_MAP[id]).filter(Boolean);
      const addonTotal=addonItems.reduce((s,a)=>s+a.price,0);
      const subtotal=cartTotal+addonTotal+deliveryCharge;
      const gstAmount=Math.round(subtotal*GST_PERCENT/100);
      const grandTotal=subtotal+gstAmount;

      const orderTypeLabel=order_type==="delivery"?"🚚 Home Delivery":order_type==="takeaway"?"🥡 Take Away":"🍽️ Dine In";
      const delivLabel=order_type==="delivery"?`Rs.${deliveryCharge} (${distanceInfo})`:"Free";
      const addonText=addonItems.map(a=>`${a.name} (Rs.${a.price})`).join(", ");
      const celebText=(Array.isArray(celebration_addons)?celebration_addons:[]).map(id=>CELEBRATION_MAP[id]||id).filter(Boolean).join(", ");
      const seatLabel=SEATING_MAP[table_seating]||table_seating||"";
      const itemsList=session.cart.map(i=>`• ${i.name} × ${i.qty} = Rs.${i.price*i.qty}`).join("\n");

      const tableInfo=
        order_type==="dine_in"&&table_persons
          ? `\n👥 *Guests:* ${table_persons}\n📅 *Date:* ${table_date}\n🕐 *Slot:* ${table_time}\n🪑 *Seating:* ${seatLabel}`+
            (occasion_name?`\n🎉 *Occasion:* ${occasion_name}`:"")+
            (celebText?`\n🎊 *Arrangements:* ${celebText}`:"")
          : order_type==="takeaway"
          ? `\n📅 *Date:* ${pickup_date||""}\n🕐 *Pickup:* ${pickup_time||"ASAP"}`
          : "";

      session.deliveryData={
        name:customer_name||"Customer",phone:customer_phone||from,
        alternate_phone:alternate_phone||"",address:full_address,
        order_type,delivery_time:"asap",
        table_persons:table_persons||"",table_date:table_date||"",
        table_time:table_time||"",table_seating:table_seating||"",seating_label:seatLabel,
        pickup_date:pickup_date||"",pickup_time:pickup_time||"",
        addons:addonItems,addon_total:addonTotal,
        delivery_charge:deliveryCharge,distance_info:distanceInfo,
        gst_amount:gstAmount,special_instructions:special_instructions||"",
        celebration_addons:Array.isArray(celebration_addons)?celebration_addons:[],
        occasion_name:occasion_name||"",grand_total:grandTotal,
        live_location:session.deliveryData?.live_location||"",
      };
      session.state="PAYMENT_SELECT";session.markModified("deliveryData");
      await session.save();
      console.log(`✅ Session saved | Grand Total: Rs.${grandTotal}`);

      const isDineIn=order_type==="dine_in";
      const billText=
        (isDineIn?`✅ *Table Booking Confirmed!*\n\n`:`🧾 *Order Bill Summary*\n\n`)+
        `👤 *Name:* ${customer_name}\n`+
        `📞 *Phone:* ${customer_phone}\n`+
        (alternate_phone?`📞 *Alt:* ${alternate_phone}\n`:"")+
        `📍 *Address:* ${full_address}\n`+
        `🚚 *Type:* ${orderTypeLabel}${tableInfo}\n`+
        (addonText?`🍱 *Add-ons:* ${addonText}\n`:"")+
        (special_instructions?`📝 *Note:* ${special_instructions}\n`:"")+
        `─────────────────\n`+
        (cartTotal>0?`🛒 *Items:*\n${itemsList}\n─────────────────\n`:"")+
        (cartTotal>0?`🛒 *Food Total:* Rs.${cartTotal}\n`:"")+
        (addonTotal>0?`🍱 *Add-ons:* Rs.${addonTotal}\n`:"")+
        (order_type==="delivery"?`🚚 *Delivery:* ${delivLabel}\n`:"")+
        `📊 *GST (5%):* Rs.${gstAmount}\n`+
        `─────────────────\n`+
        `💰 *Grand Total: Rs.${grandTotal}*\n\n`+
        `Select payment method:`;

      await sendButtons(from,billText,
        order_type==="dine_in"?[
          {id:"PAY_REST",title:"🍽️ Pay at Restaurant"},
          {id:"PAY_UPI", title:"📲 UPI Payment"},
          {id:"PAY_CARD",title:"💳 Card Payment"},
        ]:order_type==="takeaway"?[
          {id:"PAY_COD", title:"💵 Cash on Pickup"},
          {id:"PAY_UPI", title:"📲 UPI Payment"},
          {id:"PAY_CARD",title:"💳 Card Payment"},
        ]:[
          {id:"PAY_COD", title:"💵 Cash on Delivery"},
          {id:"PAY_UPI", title:"📲 UPI Payment"},
          {id:"PAY_CARD",title:"💳 Card Payment"},
        ]
      );
      return;
    }

    // ── PAYMENT ───────────────────────────────────────────
    if (["PAY_COD","PAY_UPI","PAY_CARD","PAY_REST"].includes(input)) {
      const isValidOrder = session.deliveryData?.order_type ||
                           session.deliveryData?.grand_total > 0;
      if (!isValidOrder) {
        await sendButtons(from,"❌ *No active order.*\n\nSend *hi* to start.",[{id:"hi",title:"🍴 Start Ordering"}]);
        return;
      }
      session.deliveryData.paymentMethod=input;session.markModified("deliveryData");await session.save();

      if (input==="PAY_UPI") {
        const total = session.deliveryData.grand_total;
        const link  = await generateRazorpayLink(session, from, "upi");
        if (link) {
          await sendButtons(from,
            `📲 *UPI / Online Payment*\n\n💰 Amount: *Rs.${total}*\n\n🔗 *Click to Pay Now:*\n${link}\n\nPay via PhonePe / GPay / Paytm\n\n👇 Tap below after payment:`,
            [{id:"UPI_DONE",title:"✅ Payment Done"},{id:"PAY_COD",title:"💵 Pay COD instead"}]
          );
        } else {
          const restUpi = process.env.RESTAURANT_UPI_ID || "kaviyakiruthi22@okhdfcbank";
          await sendButtons(from,
            `📲 *UPI Payment*\n\nPay to: *${restUpi}*\n💰 Amount: *Rs.${total}*\n\n👇 Tap below after payment:`,
            [{id:"UPI_DONE",title:"✅ Payment Done"},{id:"PAY_COD",title:"💵 Pay COD instead"}]
          );
        }
        return;
      }

      if (input==="PAY_CARD") {
        const total=session.deliveryData.grand_total;
        const link=await generateRazorpayLink(session,from,"card");
        if (link) {
          await sendButtons(from,
            `💳 *Card / Online Payment*\n\n💰 Amount: *Rs.${total}*\n\n🔗 Click to Pay:\n${link}\n\nPay via Credit / Debit Card / Net Banking`,
            [{id:"UPI_DONE",title:"✅ Payment Done"},{id:"PAY_COD",title:"💵 Pay COD instead"}]
          );
        } else {
          await sendText(from,"💳 Card payment will be collected at delivery/counter.");
          await placeOrder(from,session);
        }
        return;
      }

      await placeOrder(from,session);return;
    }

    // ── UPI DONE → confirm order immediately ─────────────
    if (input==="UPI_DONE") {
      session.deliveryData.paymentMethod = session.deliveryData.paymentMethod || "PAY_UPI";
      session.markModified("deliveryData");
      await session.save();
      await sendText(from, "✅ *Payment received!*\n\nConfirming your order...");
      await placeOrder(from, session);
      return;
    }

    // ── SKIP LOCATION AFTER FLOW ─────────────────────────
    if (input === "SKIP_LOCATION_AFTER_FLOW") {
      session.state = "PAYMENT_SELECT";
      await session.save();
      const d = session.deliveryData;
      if (!d?.grand_total) {
        await sendText(from, "❌ Order details missing. Send *hi* to start again.");
        return;
      }
      await sendButtons(from,
        `🧾 *Bill Summary*\n\n👤 ${d.name} | 📞 ${d.phone}\n📍 ${d.address}\n─────────────\n💰 *Total: Rs.${d.grand_total}*\n\n💳 Choose payment:`,
        [
          {id:"PAY_COD", title:"💵 Cash on Delivery"},
          {id:"PAY_UPI", title:"📲 UPI Payment"},
          {id:"PAY_CARD",title:"💳 Card Payment"},
        ]
      );
      return;
    }

    // ── FALLBACK ──────────────────────────────────────────
    await sendButtons(from,
      "🤔 Didn't get that. Send *hi* to start! 🍛",
      [{id:"hi",title:"🍴 Start Ordering"},{id:"VIEW_CART",title:"🛒 View Cart"},{id:"exit",title:"❌ Exit"}]
    );

  } catch(err) {
    console.error("❌ handleMessage Error:",err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data,null,2));
  }
};

module.exports = {handleMessage,placeOrder};
