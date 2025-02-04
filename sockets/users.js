const getIo = require('../helpers/socket').getIo;
const mongodb = require('mongodb');
const ObjectId = mongodb.ObjectId;
const User = require('../models/user');
const ChatRoom = require('../models/chatRoom');
const Message = require('../models/message');
const socketIsAuth = require('../sockets/socketIsAuth');
const socketHelpers = require('./socket-helpers');
const Group = require('../models/group');
const GroupMessage = require('../models/groupMesasage');

exports.changeActivityStatus = async ({ userToken, online }) => {
	try {
		const userId = socketIsAuth(userToken);

		const query = online === true ? { $set: { online: true } } : { $set: { online: false } };

		getIo().emit('changeActivityStatus', { userId, online });

		await User.updateUserWithCondition({ _id: new ObjectId(userId) }, query);
	} catch (error) {
		getIo().emit('changeActivityStatus', { error: error.message });
	}
};

exports.onChats = async userToken => {
	console.log('onChats');

	try {
		const userId = socketIsAuth(userToken);

		const user = await User.getUser(userId);

		const userChatRooms = user.chats; // [id, id, id]

		console.log('userChatRooms', userChatRooms);
		// get only the chats that its chatHistory has some messages

		if (userChatRooms.length < 1) {
			console.log('=====================cha')
			return getIo().emit('userChats', { userId: userId, userChats: [] });
		}

		// exclude chats with no message(chat) history
		const userChats = await ChatRoom.getChatRoomsAggregated([
			{
				$match: {
					$and: [ { _id: { $in: userChatRooms } }, { chatHistory: { $ne: [] } } ]
				}
			},

			{
				$lookup: {
					from: 'users',
					localField: 'userOne',
					foreignField: '_id',
					as: 'firstUser'
				}
			},
			{
				$lookup: {
					from: 'users',
					localField: 'userTwo',
					foreignField: '_id',
					as: 'secondUser'
				}
			},
			{
				$project: {
					userOne: 0,
					userTwo: 0,
					'firstUser.friends': 0,
					'firstUser.friendRequestsUsers': 0,
					'firstUser.notifications': 0,
					'firstUser.friendRequests': 0,
					'firstUser.password': 0,
					'firstUser.chats': 0,
					'firstUser.groups': 0,

					'secondUser.friends': 0,
					'secondUser.friendRequestsUsers': 0,
					'secondUser.notifications': 0,
					'secondUser.friendRequests': 0,
					'secondUser.password': 0,
					'secondUser.chats': 0,
					'secondUser.groups': 0
				}
			}
		]);

		console.log('userChats', userChats);
		const mappedUserChats = userChats.map(chat => {
			const newChat = { ...chat };

			newChat.firstUser = { ...newChat.firstUser[0] };
			newChat.secondUser = { ...newChat.secondUser[0] };

			const lastMessage = { ...newChat.chatHistory[newChat.chatHistory.length - 1] };
			newChat.lastMessage = lastMessage;
			newChat.lastMessageDate = lastMessage.date;

			// check unreadMessages
			let unreadMessages = 0;
			for (let i = newChat.chatHistory.length - 1; i >= 0; i--) {
				const message = newChat.chatHistory[i];

				if (message.seen === false && message.from.toString() !== userId.toString()) {
					unreadMessages++;
				}
			}

			newChat.unreadMessages = unreadMessages;

			let newChatForm = (({ _id, firstUser, secondUser, lastMessage, lastMessageDate, unreadMessages }) => ({
				_id,
				firstUser,
				secondUser,
				lastMessage,
				lastMessageDate,
				unreadMessages
			}))(newChat);

			return newChatForm;
		});

		const sortedUserChats = mappedUserChats.slice().sort((a, b) => b.lastMessageDate - a.lastMessageDate);
		console.log('==================cha')
		getIo().emit('userChats', { userId: userId, userChats: sortedUserChats });
	} catch (error) {
		getIo().emit('userChats', { error: error.message });
	}
};

// seen is done
exports.joinChatRoom = async (socket, chatRoomId, userToken) => {
	const roomToLeave = Object.keys(socket.rooms)[1];
	let userIdCopy;
	try {
		const userId = socketIsAuth(userToken);
		console.log('exports.joinChatRoom -> userId', userId);
		userIdCopy = userId;

		socket.leave(roomToLeave);

		socket.join(chatRoomId);

		socketHelpers.increaseRoomMembers(chatRoomId, 'userTwoIsActive');

		const tempChatRoom = await ChatRoom.getChatRoomAggregated([ { $match: { _id: new ObjectId(chatRoomId) } } ]);
		console.log('exports.joinChatRoom -> tempChatRoom', tempChatRoom);

		if (!tempChatRoom) throw new Error('chat room is not found');
		let chatRoom;

		if (tempChatRoom.chatHistory.length > 0) {
			chatRoom = await ChatRoom.getChatRoomAggregated([
				{ $match: { _id: new ObjectId(chatRoomId) } },

				{
					$lookup: {
						from: 'users',
						localField: 'userOne',
						foreignField: '_id',
						as: 'firstUser'
					}
				},
				{
					$lookup: {
						from: 'users',
						localField: 'userTwo',
						foreignField: '_id',
						as: 'secondUser'
					}
				},

				{ $unwind: '$chatHistory' },
				{
					$lookup: {
						from: 'users',
						foreignField: '_id',
						localField: 'chatHistory.from',
						as: 'chatHistory.fromUser'
					}
				},
				{ $unwind: '$chatHistory.from' },
				{ $group: { _id: '$_id', root: { $mergeObjects: '$$ROOT' }, chatHistory: { $push: '$chatHistory' } } },
				{ $replaceRoot: { newRoot: { $mergeObjects: [ '$root', '$$ROOT' ] } } },

				{ $project: { root: 0 } },

				{
					$project: {
						userOne: 0,
						userTwo: 0,
						// firstUser
						'firstUser.friends': 0,
						'firstUser.friendRequestsUsers': 0,
						'firstUser.notifications': 0,
						'firstUser.friendRequests': 0,
						'firstUser.password': 0,

						// secondUser
						'secondUser.friends': 0,
						'secondUser.friendRequestsUsers': 0,
						'secondUser.notifications': 0,
						'secondUser.friendRequests': 0,
						'secondUser.password': 0
					}
				}
			]);
		} else {
			chatRoom = await ChatRoom.getChatRoomAggregated([
				{ $match: { _id: new ObjectId(chatRoomId) } },

				{
					$lookup: {
						from: 'users',
						localField: 'userOne',
						foreignField: '_id',
						as: 'firstUser'
					}
				},
				{
					$lookup: {
						from: 'users',
						localField: 'userTwo',
						foreignField: '_id',
						as: 'secondUser'
					}
				},
				{
					$project: {
						userOne: 0,
						userTwo: 0,
						// firstUser
						'firstUser.friends': 0,
						'firstUser.friendRequestsUsers': 0,
						'firstUser.notifications': 0,
						'firstUser.friendRequests': 0,
						'firstUser.password': 0,

						// secondUser
						'secondUser.friends': 0,
						'secondUser.friendRequestsUsers': 0,
						'secondUser.notifications': 0,
						'secondUser.friendRequests': 0,
						'secondUser.password': 0
					}
				}
			]);
		}

		// tweek our chatRoom a little bit
		const newChatRoom = { ...chatRoom };

		newChatRoom.firstUser = { ...newChatRoom.firstUser[0] };
		newChatRoom.secondUser = { ...newChatRoom.secondUser[0] };

		// do the same for chatHistory messages..

		const newChatHistory = socketHelpers.newChatHistory(newChatRoom);

		newChatRoom.chatHistory = newChatHistory;

		// set the undread messages from the other user to seen
		let newUnreadMessages = [];
		let newUnreadMessagesSender;
		for (let message of newChatRoom.chatHistory) {
			console.log(message);
			if (message.seen === false && message.fromUser._id.toString() !== userId.toString()) {
				newUnreadMessages.push(message._id);

				if (!newUnreadMessagesSender) newUnreadMessagesSender = message.fromUser._id.toString();
			}
		}

		console.log('exports.joinChatRoom -> newUnreadMessages', newUnreadMessages);
		if (newUnreadMessages.length > 0) {
			getIo().emit('setUnseenMessagesToTrue', {
				messages: newUnreadMessages,
				room: chatRoomId,
				to: newUnreadMessagesSender
			});

			await ChatRoom.updateChatWithCondition(
				{ _id: new ObjectId(chatRoomId) },
				{ $set: { 'chatHistory.$[el].seen': true } },
				{ arrayFilters: [ { 'el._id': { $in: newUnreadMessages } } ] }
			);
		}

		getIo().emit('chatRoomIsJoined', { chatRoom: newChatRoom, to: userId });
	} catch (error) {
		getIo().emit('chatRoomIsJoined', { error: error.message, to: userIdCopy });
	}
};

exports.sendPrivateMessage = async (socket, messageData, userToken) => {
	const { userName, phone,height,city,latitude,longitude, message, to } = messageData;
	try {
		const from = socketIsAuth(userToken);

		const clientChatRoom = Object.keys(socket.rooms)[1]; // the chatRoomId of the user

		const newMessage = new Message(message, from);

		// making instanced message to prevent aggregation the from while realtime texting
		const quickMessageForOtherUser = {
			_id: newMessage._id,
			date: newMessage.date,
			seen: newMessage.seen,
			fromUser: {
				_id: from,
				userName: userName,
				phone: phone,
				height:height,
				city:city,
				latitude:latitude,
				longitude:longitude,
			},
			message: message
		};

		console.log('whoSentMessage =>>>', socket.id);

		getIo().in(clientChatRoom).emit('privateMessageBack', quickMessageForOtherUser);

		// send another event to handle the outside
		await newMessage.addMessage(clientChatRoom);

		getIo().emit('privateMessageBackFromOutside', to);
	} catch (error) {
		getIo().emit('privateMessageBack', { error: error.message });
	}

	// emit the message back to the other user before it is store in the databse for fast performance
};

exports.messageSeen = async (socket, { messageId }) => {
	try {
		const clientChatRoom = Object.keys(socket.rooms)[1]; // the chatRoomId of the user

		getIo().in(clientChatRoom).emit('seen', messageId);

		await ChatRoom.updateChatWithCondition(
			{ 'chatHistory._id': messageId },
			{ $set: { 'chatHistory.$.seen': true } },
			null
		);
	} catch (error) {
		getIo().emit('seen', { error: error.message });
	}
};

// needs some aggregation
exports.joinGroupRoom = async (socket, groupRoomId, userToken) => {
	let userIdCopy;
	try {
		const userId = socketIsAuth(userToken);

		userIdCopy = userId;

		// basic aggregation
		let group = await Group.getGroupAggregated([
			{ $match: { _id: new ObjectId(groupRoomId) } },

			{ $lookup: { from: 'users', localField: 'members', foreignField: '_id', as: 'groupMembers' } },

			{
				$project: {
					members: 0
				}
			}
		]);
		if (!group) throw new Error('Group is not found');

		const roomToLeave = Object.keys(socket.rooms)[1];

		console.log('exports.joinGroupRoom -> roomToLeave', roomToLeave);

		socket.leave(roomToLeave);

		socket.join(groupRoomId);

		socketHelpers.increaseRoomMembers(groupRoomId, 'aMemberJoinedAGroup');

		// prevent aggregate messages users if the chatHistory is empty to prevent errors
		if (group.chatHistory.length === 0) {
			if (group.groupMembers.length > 0) {
				const newMembers = socketHelpers.projectGroupMembers(group);
				group.groupMembers = newMembers;
			}

			return getIo().emit('atGroupRoom', { group: group, to: userId });
		}

		group = await Group.getGroupAggregated([
			{ $match: { _id: new ObjectId(groupRoomId) } },

			{ $lookup: { from: 'users', localField: 'members', foreignField: '_id', as: 'groupMembers' } },

			{ $unwind: '$chatHistory' },
			{
				$lookup: {
					from: 'users',
					foreignField: '_id',
					localField: 'chatHistory.from',
					as: 'chatHistory.fromUser'
				}
			},
			{ $unwind: '$chatHistory.from' },
			{ $group: { _id: '$_id', root: { $mergeObjects: '$$ROOT' }, chatHistory: { $push: '$chatHistory' } } },
			{ $replaceRoot: { newRoot: { $mergeObjects: [ '$root', '$$ROOT' ] } } },

			{ $project: { root: 0 } },

			{
				$project: {
					members: 0
				}
			}
		]);

		if (group.groupMembers.length > 0) {
			const newMembers = socketHelpers.projectGroupMembers(group);
			group.groupMembers = newMembers;
		}

		const newChatHistory = socketHelpers.newChatHistory(group);
		group.chatHistory = newChatHistory;

		getIo().emit('atGroupRoom', { group: group, to: userId });
	} catch (error) {
		getIo().emit('atGroupRoom', { error: error.message, to: userIdCopy });
	}
};

exports.sendGroupMessage = async (socket, messageData, userToken) => {
	const { userName, birthday,height,city,latitude,longitude,phone, message } = messageData;
	const clientGroupRoom = Object.keys(socket.rooms)[1];

	let userIdCopy;
	try {
		const from = socketIsAuth(userToken);

		userIdCopy = from;

		if (!from) throw new Error('user is not found');

		const groupMessage = new GroupMessage(from, message);

		const virtualMessage = {
			_id: groupMessage._id,
			data: groupMessage.data,

			fromUser: {
				_id: from,
				userName: userName,
				phone: phone,
				height:height,
				birthday:birthday,
				city:city,
				latitude,
				longitude,
			},

			message: message
		};

		getIo().in(clientGroupRoom).emit('groupMessage', virtualMessage);

		await groupMessage.addMessasge(clientGroupRoom);
	} catch (error) {
		getIo().emit('groupMessage', { error: error.message, to: userIdCopy });
	}
};
