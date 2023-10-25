const sendError = require('../helpers/sendError');
const jwt = require('jsonwebtoken');
const bcyrpt = require('bcryptjs');
const User = require('../models/user');

exports.postSignUp = async (req, res, next) => {
	console.log(req.body)

	const { userName, birthday, age, city, phone, password, gender, height,wechat, introduction,latitude, longitude } = req.body;
	try {
		// check if this phone is taken by some user
		const foundUser = await User.getUserWithCondition({ phone: phone });

		if (foundUser){
			// sendError('This phone is taken, choose an alternative', 403);
			res.status(209).json ({
				status:209,
				err_msg: 'This phone is taken, choose an alternative'
			})
			return
		}
		// const hashedPassword = await bcyrpt.hash(password, 12);
		const user = new User(userName,userName, birthday, age, city, gender, password,phone, height,wechat,introduction,latitude,longitude);
		
		// add the user to the database
		const addingResult = await user.addUser();

		const insertedUserId = addingResult.insertedId;

		const token = createToken(phone, insertedUserId, insertedUserId)
		res.status(201).json({ 
			status: 200,
			data: {
				token: token,
				message: 'User Signed up successfully.',
			 	userId: insertedUserId,
				id: insertedUserId,
				user: user
			} 
			});
	} catch (error) {
		if (!error.statusCode) error.statusCode = 500;
		next(error);
	}
};

exports.postSignin = async (req, res, next) => {
	const { phone, password } = req.body;

	try {
		// check if we have this user in our database
		const foundUser = await User.getUserWithConditionForLogin({ phone: phone });

		if (!foundUser) sendError('User with given phone does not exist!', 401);

		// check for the validity of the password
		// const matched = await bcyrpt.compare(password, foundUser.password);
		const matched = (password === foundUser.password)
		// if not matched, send error
		if (!matched) sendError('Wrong Password', 401);

		// else... make a token, send it to the client
		const token = createToken(phone, foundUser._id.toString(),foundUser._id.toString())
		// jwt.sign(
		// 	{
		// 		// firstName: foundUser.firstName,
		// 		// lastName: foundUser.lastName,
		// 		// country: foundUser.country,
		// 		email: email,
		// 		userId: foundUser._id.toString(),
		// 		id:foundUser._id.toString(),
		// 	},
		// 	`${process.env.TOKEN_SECRET}`,
		// 	{
		// 		expiresIn: '1d'
		// 	}
		// );

		res.status(200).json({
			status: 200,
			data: {
				message: `${foundUser.userName} ${foundUser.phone} has logged in successfully`,
				token: token,
				userId: foundUser._id.toString(),
				id: foundUser._id.toString(),
				user: foundUser
			}
		});
	} catch (error) {
		if (!error.statusCode) error.statusCode = 500;
		next(error);
	}
};

function createToken(phone ,userId, foundUserId) {
	const token = jwt.sign(
		{
			phone: phone,
			userId:userId,
			id:foundUserId,
			exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365)
		},
		`${process.env.TOKEN_SECRET}`,
		// {
		// 	expiresIn: '365d'
		// }
	);
	return token
}
