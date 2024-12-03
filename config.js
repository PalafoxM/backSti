// config.js
require('dotenv').config();

module.exports = {
    moodleUrl: process.env.MOODLE_URL,
    moodleToken: process.env.MOODLE_TOKEN,
    token_sti: process.env.TOKEN_STI,
    usuario: process.env.USUARIO,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    host: process.env.HOST
};
