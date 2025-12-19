// E:\study\techfix\techfix-app\src\api\sheetsClient.js
import client from './client';

const SHEETS_API = {
  // Get complaints for technician
  getComplaints: async (technician, fromDate, toDate) => {
    try {
      const response = await client.get('/get-complaints/', {
        params: {
          technician,
          from: fromDate,
          to: toDate,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching complaints:', error);
      throw error;
    }
  },

    // Update complaint status
  updateComplaintStatus: async (complaintNo, newStatus) => {
    try {
      const response = await client.post('/update-complaint/', {
        complaint_no: complaintNo,
        status: newStatus,
      });
      return response.data;
    } catch (error) {
      console.error('Error updating complaint:', error);
      throw error;
    }
  },

  // Get spare pending items (technician view)
  getSparePending: async () => {
    try {
      const response = await client.get('/spare/pending/');
      return response.data;
    } catch (error) {
      console.error('Error fetching spare pending:', error);
      throw error;
    }
  },

  // Get spare closed items with date range
  getSpareClosed: async (fromDate, toDate) => {
    try {
      const response = await client.get('/spare/closed/', {
        params: {
          from_date: fromDate,
          to_date: toDate,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching spare closed:', error);
      throw error;
    }
  },

  // Update spare status (technician requests change)
  updateSpareStatus: async (complaintNo, newStatus) => {
    try {
      const response = await client.post('/spare/update-status/', {
        complaint_no: complaintNo,
        new_status: newStatus,
      });
      return response.data;
    } catch (error) {
      console.error('Error updating spare status:', error);
      throw error;
    }
  },
  createSpareRequest: async (complaintData) => {
    try {
      const response = await client.post('/spare-request/create/', {
        complaint_no: complaintData.complaint_no,
        customer_name: complaintData.customer_name,
        customer_phone: complaintData.phone,
        area: complaintData.area,
        brand_name: complaintData.brand_name,
        product_code: complaintData.product_code,
        part_name: complaintData.part_name,
        no_of_spares: complaintData.no_of_spares,
        district: complaintData.district || '',
      });
      return response.data;
    } catch (error) {
      console.error('Error creating spare request:', error);
      throw error;
    }
  },

  // Get my spare requests (technician view)
  getMySpareRequests: async (statusFilter = null) => {
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await client.get('/spare-request/my-requests/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching my spare requests:', error);
      throw error;
    }
  },

  // Get all spare requests (admin view)
  getAllSpareRequests: async () => {
    try {
      const response = await client.get('/spare-request/all-requests/');
      return response.data;
    } catch (error) {
      console.error('Error fetching all spare requests:', error);
      throw error;
    }
  },

  // Admin approves a spare request
  approveSparerequest: async (requestId, adminNotes = '') => {
    try {
      const response = await client.post('/spare-request/approve/', {
        request_id: requestId,
        admin_notes: adminNotes,
      });
      return response.data;
    } catch (error) {
      console.error('Error approving spare request:', error);
      throw error;
    }
  },

  // Admin rejects a spare request
  rejectSpareRequest: async (requestId, adminNotes = '') => {
    try {
      const response = await client.post('/spare-request/reject/', {
        request_id: requestId,
        admin_notes: adminNotes,
      });
      return response.data;
    } catch (error) {
      console.error('Error rejecting spare request:', error);
      throw error;
    }
  },

};


export default SHEETS_API;
