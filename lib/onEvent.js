module.exports = function (Kirbi) {
    require('./onEvent/auth_and_connect')(Kirbi);
    require('./onEvent/message')(Kirbi);
};
