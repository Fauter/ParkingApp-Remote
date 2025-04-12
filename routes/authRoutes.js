const express = require('express');
const { register, login, getAllUsers, getProfile, deleteAllUsers } = require('../controllers/authControllers');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/', getAllUsers);
router.get('/profile', getProfile);

router.delete('/delete-all', deleteAllUsers);

module.exports = router;