const ReferenceData = require('../models/referenceData');
const AuditLog = require('../models/auditLog');

/**
 * Get all reference data (services)
 */
const getAllServices = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, is_available } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (category) where.category = category;
    if (is_available !== undefined) where.is_available = is_available === 'true';

    const services = await ReferenceData.findAndCountAll({
      where,
      order: [['service_name', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      services: services.rows,
      total: services.count,
      page: parseInt(page),
      totalPages: Math.ceil(services.count / limit)
    });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({ message: 'Server error fetching services' });
  }
};

/**
 * Get service by ID
 */
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await ReferenceData.findByPk(id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    console.error('Get service by ID error:', error);
    res.status(500).json({ message: 'Server error fetching service' });
  }
};

/**
 * Create a new service (reference data)
 */
const createService = async (req, res) => {
  try {
    const { service_name, category, is_available, base_cost } = req.body;

    if (!service_name) {
      return res.status(400).json({ message: 'Service name is required' });
    }

    const service = await ReferenceData.create({
      service_name,
      category,
      is_available: is_available !== undefined ? is_available : true,
      base_cost: base_cost || 0
    });

    // Log service creation
    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'SERVICE_CREATED',
      details: `Service ${service_name} created by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.status(201).json({
      message: 'Service created successfully',
      service
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Server error creating service' });
  }
};

/**
 * Update service
 */
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, category, is_available, base_cost } = req.body;

    const service = await ReferenceData.findByPk(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    await service.update({
      service_name: service_name || service.service_name,
      category: category !== undefined ? category : service.category,
      is_available: is_available !== undefined ? is_available : service.is_available,
      base_cost: base_cost !== undefined ? base_cost : service.base_cost
    });

    // Log service update
    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'SERVICE_UPDATED',
      details: `Service ${service.service_name} updated by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ message: 'Server error updating service' });
  }
};

/**
 * Delete service
 */
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await ReferenceData.findByPk(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    await service.destroy();

    // Log service deletion
    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'SERVICE_DELETED',
      details: `Service ${service.service_name} deleted by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ message: 'Server error deleting service' });
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService
};