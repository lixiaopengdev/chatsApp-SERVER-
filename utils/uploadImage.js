const fs = require("fs");
const cloudinary = require("cloudinary").v2;

const uploadImage = async (image, folder) => {
	const result = await cloudinary.uploader.upload(image.tempFilePath,{folder :folder, type:'upload'}, {
		use_filename: true,
		folder: "fb-clone-posts",
	});
	fs.unlinkSync(image.tempFilePath);
	return result;
};

module.exports = uploadImage;
