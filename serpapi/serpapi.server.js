require("dotenv").config();
const { getJson } = require("serpapi");

getJson({
  engine: "google_lens",
  url: "https://res.cloudinary.com/dqxybdhql/image/upload/c_thumb,e_sharpen:200,g_center,h_300,q_100,w_300,z_3.0/j6pr0flvnf0qzcjh7ior?_a=BAMAOGLU0",
  api_key: process.env.SERP_API_KEY
}, (json) => {
  const withPrice = json["visual_matches"].filter(item => item.price);
  console.log(withPrice);
});