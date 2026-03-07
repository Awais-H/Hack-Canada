require("dotenv").config();
const { getJson } = require("serpapi");

getJson({
  engine: "google_lens",
  url: "https://ecotonelamisport.ca/wp-content/uploads/2021/08/YETI-RAMBLER-BOUTEILLE-DEAU-ISOTHERME-DE-1L-36-OZ-BSB.jpg",
  api_key: process.env.SERP_API_KEY
}, (json) => {
  const withPrice = json["visual_matches"].filter(item => item.price);
  console.log(withPrice);
});