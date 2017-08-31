module.exports = function (Kirbi) {
	require('./onEvent/auth-and-connect')(Kirbi);
	require('./onEvent/message')(Kirbi);
};
