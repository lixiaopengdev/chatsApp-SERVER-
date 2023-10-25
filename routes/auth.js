const express = require('express');
const { body } = require('express-validator');
const mongodb = require('mongodb');
const authControllers = require('../controllers/auth');
const checkValidation = require('../middlewares/checkValidation');
const ObjectId = mongodb.ObjectId;

const router = express.Router();
// POST @ /sinup
router.post(
	'/signup',
	[
		body('userName', 'userName must not be empty and in characters').trim().notEmpty(),
		body('birthday', 'Brithday must not be empty and in characters').trim().notEmpty(),
		// body('email', 'Email is not a valid email').trim().isEmail(),
		body('phone', 'Phone must not be empty and in characters').trim().notEmpty(),
		body('city', 'Country must not be empty, only in characters').trim().notEmpty(),
		body('age', 'Age must be in numbers').trim().notEmpty(),
		body('gender', 'Gender must not be empty').trim().notEmpty(),
		body('password', 'Password must be 6 characters at least').trim().notEmpty(),
		body('height', 'height must not be empty').trim().notEmpty(),
		body('wechat'),
		body('introduction','Introduct must not be empty').trim().notEmpty()

	],
	checkValidation,
	authControllers.postSignUp
);

// POST @ /auth/signin
router.post(
	'/signin',
	[
		body('phone', 'Phone must be a valid phone').notEmpty(),
		body('password', 'Please write down your password').notEmpty()
	],
	checkValidation,
	authControllers.postSignin
);

module.exports = router;
