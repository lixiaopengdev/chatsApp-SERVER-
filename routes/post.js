const express = require("express");
const {
	createPost,
	getPosts,
	likePost,
	commentPost,
	deletePost,
	updatePost,
	deleteComment,
	editComment,
} = require("../controllers/post");
const isAuth = require("../middlewares/isAuth");
const router = express.Router();

router.route("/").post(isAuth, createPost).get(getPosts);
router.route("/like").patch(isAuth, likePost);
router
	.route("/comment")
	.post(isAuth, commentPost)
	.delete(isAuth, deleteComment)
	.patch(isAuth, editComment);
router.route("/:id").delete(isAuth, deletePost).patch(isAuth, updatePost);

module.exports = router;
