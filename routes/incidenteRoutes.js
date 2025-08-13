const express = require('express');
const router = express.Router();

const {
  create,
  getAll,
  getById,
  updateById,
  deleteAll
} = require('../controllers/incidenteControllers');

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', updateById);
router.delete('/', deleteAll);

module.exports = router;
