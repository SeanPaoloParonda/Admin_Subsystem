// ── What this file does ──────────────────────────────────────────────────────
// This file contains the controller functions for managing the hospital's
// service catalog (reference data):
//   - getAllServices:  list all services with optional filtering and pagination
//   - getServiceById: get a single service by its ID
//   - createService:  add a new service to the catalog
//   - updateService:  update an existing service's details
//   - deleteService:  deactivate a service (soft delete — not permanently removed)
//
// These functions are called by the routes in routes/referenceRoutes.js.
// They are also called directly from server.js for the subsystem-facing endpoints.
// ─────────────────────────────────────────────────────────────────────────────

// Import the ReferenceData model for database queries
const ReferenceData = require('../models/referenceData');

// logAdminAction records important events in the audit log
const { logAdminAction } = require('../utils/auditUtils');

/**
 * getAllServices
 *
 * Returns a paginated list of services from the catalog.
 * Supports optional filtering by category and availability.
 *
 * GET /admin/api/reference
 * Query params: page, limit, category, is_available
 */
const getAllServices = async (req, res) => {
  try {
    // Extract filter and pagination options from the query string
    const { page = 1, limit = 20, category, is_available } = req.query;

    // Calculate how many records to skip based on the current page
    const offset = (page - 1) * limit;

    // Build the WHERE clause dynamically based on which filters were provided
    const where = {};
    if (category) where.category = category;

    // is_available comes in as a string ('true' or 'false') from the URL,
    // so we convert it to a boolean for the database query
    if (is_available !== undefined) where.is_available = is_available === 'true';

    // Fetch the matching services with pagination
    const services = await ReferenceData.findAndCountAll({
      where,
      order: [['service_name', 'ASC']], // alphabetical order by service name
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Return the services along with pagination metadata
    res.json({
      services: services.rows,                          // the services for this page
      total: services.count,                            // total matching services
      page: parseInt(page),
      totalPages: Math.ceil(services.count / limit)     // how many pages exist
    });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({ message: 'Server error fetching services' });
  }
};

/**
 * getServiceById
 *
 * Returns a single service record by its service_id.
 *
 * GET /admin/api/reference/:id
 */
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await ReferenceData.findByPk(id);

    // Return 404 if the service doesn't exist
    if (!service) return res.status(404).json({ message: 'Service not found' });

    res.json(service);
  } catch (error) {
    console.error('Get service by ID error:', error);
    res.status(500).json({ message: 'Server error fetching service' });
  }
};

/**
 * createService
 *
 * Adds a new service to the hospital's service catalog.
 * Records the creation in the audit log.
 *
 * POST /admin/api/reference
 * Body: { service_name, category, is_available, base_cost }
 */
const createService = async (req, res) => {
  try {
    const { service_name, category, is_available, base_cost } = req.body;

    // service_name is required — every service must have a name
    if (!service_name) return res.status(400).json({ message: 'Service name is required' });

    // Create the new service record in the database
    const service = await ReferenceData.create({
      service_name,
      category,
      // Default to available (true) if not specified
      is_available: is_available !== undefined ? is_available : true,
      // Default to 0 cost if not specified
      base_cost: base_cost || 0
    });

    // Record the service creation in the audit log
    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'REFERENCE_CREATED',
      details: `Service ${service_name} created by ${req.user.username}`,
      ip_addr: req.ip
    });

    res.status(201).json({ message: 'Service created successfully', service });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Server error creating service' });
  }
};

/**
 * updateService
 *
 * Updates an existing service's name, category, availability, or cost.
 * Records the update in the audit log.
 *
 * PATCH /admin/api/reference/:id
 * Body: { service_name, category, is_available, base_cost }
 */
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, category, is_available, base_cost } = req.body;

    // Find the service to update
    const service = await ReferenceData.findByPk(id);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    // Update only the fields that were provided in the request.
    // For each field: use the new value if provided, otherwise keep the existing value.
    await service.update({
      service_name: service_name || service.service_name,
      category:     category !== undefined ? category : service.category,
      is_available: is_available !== undefined ? is_available : service.is_available,
      base_cost:    base_cost !== undefined ? base_cost : service.base_cost
    });

    // Record the update in the audit log
    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'REFERENCE_UPDATED',
      details: `Service ${service.service_name} updated by ${req.user.username}`,
      ip_addr: req.ip
    });

    res.json({ message: 'Service updated successfully', service });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ message: 'Server error updating service' });
  }
};

/**
 * deleteService
 *
 * Deactivates a service by setting is_available to false.
 * This is a "soft delete" — the service record is kept in the database
 * for historical reference (e.g., past bills that referenced this service),
 * but it will no longer appear as an active service.
 *
 * PATCH /admin/api/reference/:id/deactivate
 */
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await ReferenceData.findByPk(id);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    // Set is_available to false — the service is now deactivated
    await service.update({ is_available: false });

    // Record the deactivation in the audit log
    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'REFERENCE_DEACTIVATED',
      details: `Service ${service.service_name} deactivated by ${req.user.username}`,
      ip_addr: req.ip
    });

    res.json({ message: 'Service deactivated successfully' });
  } catch (error) {
    console.error('Deactivate service error:', error);
    res.status(500).json({ message: 'Server error deactivating service' });
  }
};

// Export all functions for use in the reference routes and server.js
module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService
};
