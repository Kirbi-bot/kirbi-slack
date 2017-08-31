module.exports = function (Kirbi) {
	require('./onEvent/authAndConnect')(Kirbi);
	require('./onEvent/message')(Kirbi);
};
