const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const AccountModel = require('../models/accountModel');
require('dotenv').config();
const CREDENTIALS_MSG   = 'Укажите email и пароль';
const CREDENTIALS_INVALID_MSG   = 'Неверные email или пароль';
const REGISTRATION_SUCCESS_MSG   = 'Пользователь зарегистрирован успешно';
const tokenExpiredTime = '3h'; // Время жизни токена
const pool = require('../config');
const version = '1.00'
const { DateTime } = require('luxon');

exports.register = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: CREDENTIALS_MSG });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create(email, hashedPassword, name);
    const user = await User.findByEmail(email);  // находим пользователя в БД
    const account = await AccountModel.create(user.id);  // создали счет
    res.status(201).json({ message: REGISTRATION_SUCCESS_MSG  });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: CREDENTIALS_MSG });
  }

  try {
    const user = await User.findByEmail(email);  // находим пользователя в БД
    if (!user) {
      return res.status(400).json({ message: CREDENTIALS_INVALID_MSG });
    }

    const isMatch = await bcrypt.compare(password, user.password); // сравниваем хэш пароля, вынесли в отдельную функцию чтобы sql-inject снизить
    if (!isMatch) {
      return res.status(400).json({ message: CREDENTIALS_INVALID_MSG });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: tokenExpiredTime}); // герерируем токен
    res.json({ token })
  } catch (error) {
    res.status(500).json({ message: error.message }); // выводим ошибку
  }
};

exports.logout = async (req, res) => {
  const token = req.token; // Получаем токен из запроса (в middleware)
  res.status(200).json({ message: 'Вы успешно вышли из системы.' });
}

exports.health = async (req, res) => {
  var startTime = new Date(); // Начало отсчета
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Failed to obtain connection from pool:', err);
      res.status(500).json({  health: false, message: 'Server error' }); // выводим ошибку
    } else {
      console.log('Connection is active');
      var endTime = new Date(); // Конец отсчета
                                 // Установка времени в UTC и перевод в нужную временную зону
      const utcDate = DateTime.fromISO('2024-10-31T12:00:00Z', { zone: 'utc' });
      const formattedDate = utcDate.setZone('America/New_York').toLocaleString(DateTime.DATETIME_FULL);
      console.log(formattedDate); // Отобразит дату и время в формате и временной зоне Нью-Йорка
      res.status(200).json({ health: true, version : version, delay : (endTime - startTime), datetime : formattedDate}); // выводим ошибку
      connection.release();
    }
  });
 
  
}