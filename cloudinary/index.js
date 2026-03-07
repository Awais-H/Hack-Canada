const { uploadImage, generateSmartCroppedUrl } = require("./cloudinary");

async function run() {
  try {
    const imageUrl = "https://media.discordapp.net/attachments/1479725705032896552/1479902601498857663/Screenshot_2026-03-07_at_1.04.10_PM.png?ex=69adba33&is=69ac68b3&hm=6612a0d012dcd36aeeb4c6a5f38b11acdff8e36efb96b5d836a10dfe92e7c415&=&format=webp&quality=lossless&width=394&height=700";
    console.log("Uploading image:", imageUrl);
    const uploaded = await uploadImage(imageUrl);
    console.log("Upload result:", uploaded);
    if (!uploaded.public_id) {
      throw new Error("Upload failed: No public_id returned");
    }
    const croppedUrl = generateSmartCroppedUrl(uploaded.public_id, { width: 300, height: 300 });
    console.log("Cropped URL:", croppedUrl);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();