const mongodb = require('mongodb');

const ObjectId = mongodb.ObjectId;
const db = require('../helpers/db').getDb;

const collectionName = 'users';

class User {
	constructor(name, userName, birthday, age, city, gender, password,phone, height,wechat,introduction ,latitude,longitude) {
		// personal properties
		this.name = name;
		this.userName = userName;
		this.birthday = birthday;
		this.age = age;
		this.city = city;
		this.gender = gender;
		this.password = password;
		this.phone = phone;
		this.height = height;
		this.wechat = wechat;
		this.introduction = introduction;
		this.latitude = latitude;
		this.longitude = longitude;
		this.email = '';
		this.constellation = '';
		this.profileImage = '';
		this.hobbies = [];
		this.img = null;
		this.displayImgs = [];
		this.joinedAt = new Date();
		// advanced properties
		this.bio = 'Hey there, Iam using chatsApp!';
		this.online = false;
		this.friendRequestsUsers = [];
		this.friendRequests = [];
		this.notifications = [];
		this.friends = [];
		this.chats = [];
		this.groups = [];
		this.profileViewers = [];
	}

	addUser = () => {
		return db().collection(collectionName).insertOne(this);
	};

	static getUser = userId => {
		return db().collection(collectionName).findOne({ _id: new ObjectId(userId) }, { projection: { password: 0 } });
	};

	static getUserAggregatedFixed = userId => {
		return db()
			.collection(collectionName)
			.aggregate([
				{ $match: { _id: new ObjectId(userId) } },
				{ $project: { password: 0, phone:0 , notifications: 0, chats: 0, groups: 0 ,phone:0 } },
				{ $lookup: { from: 'users', localField: 'friends', foreignField: '_id', as: 'userFriends' } },
				{
					$project: {
						'userFriends.password': 0,
						'userFriends.friendRequestsUsers': 0,
						'userFriends.notifications': 0,
						'userFriends.friends': 0,
						'userFriends.chats': 0,
						'userFriends.groups': 0
					}
				}
			])
			.next();
	};
	static getUserAggregated = aggregationArr => {
		return db().collection(collectionName).aggregate(aggregationArr).next();
	};

	static getUserCount = () => {
		return db().collection(collectionName).countDocuments();
	}

	static getUsersAggregated = aggregationArr => {
		return db().collection(collectionName).aggregate(aggregationArr).toArray();
	};

	static getUserWithConditionForLogin = condition => {
		return db().collection(collectionName).findOne(condition);
	};

	static getUserWithCondition = condition => {
		return db().collection(collectionName).findOne(condition, { projection: { password: 0 } });
	};

	static getUsersWithCondition = filterObj => {
		return db().collection(collectionName).find(filterObj, { projection: { password: 0 } }).toArray();
	};

	static updateUserWithCondition = (conditionObj, updatingObj) => {
		return db().collection(collectionName).updateOne(conditionObj, updatingObj);
	};

	static removeNotification = (userId, notifcationId) => {
		return db()
			.collection(collectionName)
			.updateOne({ _id: new ObjectId(userId) }, { $pull: { notifications: { _id: { $eq: notifcationId } } } });
	};

	static removeFriendRequest = (userId, friendRequestId) => {
		return db()
			.collection(collectionName)
			.updateOne({ _id: new ObjectId(userId) }, { $pull: { friendRequests: { _id: { $eq: friendRequestId } } } });
	};

	static updateUsersWithACondition = (conditionObj, updatingObj) => {
		return db().collection(collectionName).updateMany(conditionObj, updatingObj);
	};
}

module.exports = User;
