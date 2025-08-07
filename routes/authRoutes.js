const express = require('express');
const { 
    register,
    login, 
    getAllUsers, 
    getAllUsersWithPassword,
    getUserById,
    getProfile, 
    updateUser,
    deleteAllUsers,
    deleteUserById,
} = require('../controllers/authControllers');

const authMiddleware = require('../middlewares/authMiddleware')

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/', getAllUsers);
router.get('/full', getAllUsersWithPassword);
router.get('/profile', authMiddleware, getProfile);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUserById);
router.delete('/delete-all', deleteAllUsers);

module.exports = router;