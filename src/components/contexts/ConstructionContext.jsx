import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCompany } from './CompanyContext';
import { constructionService } from '@/api/services/construction';

const ConstructionContext = createContext();

export const useConstructionContext = () => {
  const context = useContext(ConstructionContext);
  if (!context) {
    throw new Error('useConstructionContext must be used within ConstructionProvider');
  }
  return context;
};

export const ConstructionProvider = ({ children }) => {
  const { activeCompany } = useCompany();

  // Projects state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);

  // Smeta state
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);

  // Dashboard state
  const [projectDashboard, setProjectDashboard] = useState(null);

  // Status constants
  const PROJECT_STATUS = {
    DRAFT: 'draft',
    APPROVED: 'approved',
    IN_PROGRESS: 'in_progress',
    ON_HOLD: 'on_hold',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  };

  const PROJECT_TYPES = {
    RESIDENTIAL: 'residential',
    COMMERCIAL: 'commercial',
    INDUSTRIAL: 'industrial',
    INFRASTRUCTURE: 'infrastructure'
  };

  const SMETA_STATUS = {
    DRAFT: 'draft',
    APPROVED: 'approved',
    LOCKED: 'locked'
  };

  const ITEM_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    VERIFIED: 'verified'
  };

  // Load projects when company changes
  useEffect(() => {
    if (activeCompany?.id) {
      loadProjects();
    }
  }, [activeCompany?.id]);

  // Load projects
  const loadProjects = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const data = await constructionService.listProjects(params);
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading construction projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single project
  const getProject = useCallback(async (id) => {
    try {
      setLoading(true);
      const data = await constructionService.getProject(id);
      setSelectedProject(data);
      return data;
    } catch (error) {
      console.error('Error loading project:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create project
  const createProject = useCallback(async (projectData) => {
    try {
      const result = await constructionService.createProject(projectData);
      await loadProjects();
      return result;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }, [loadProjects]);

  // Update project
  const updateProject = useCallback(async (id, projectData) => {
    try {
      const result = await constructionService.updateProject(id, projectData);
      await loadProjects();
      if (selectedProject?.id === id) {
        setSelectedProject(prev => ({ ...prev, ...projectData }));
      }
      return result;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }, [loadProjects, selectedProject]);

  // Delete project
  const deleteProject = useCallback(async (id) => {
    try {
      await constructionService.deleteProject(id);
      await loadProjects();
      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }, [loadProjects, selectedProject]);

  // Load project dashboard
  const loadProjectDashboard = useCallback(async (projectId) => {
    try {
      const data = await constructionService.getProjectDashboard(projectId);
      setProjectDashboard(data);
      return data;
    } catch (error) {
      console.error('Error loading project dashboard:', error);
      throw error;
    }
  }, []);

  // =====================================================
  // SMETA SECTIONS
  // =====================================================

  // Load sections for a project
  const loadSections = useCallback(async (projectId) => {
    try {
      const data = await constructionService.listSections(projectId);
      setSections(data || []);
      return data;
    } catch (error) {
      console.error('Error loading smeta sections:', error);
      setSections([]);
      throw error;
    }
  }, []);

  // Create section
  const createSection = useCallback(async (projectId, sectionData) => {
    try {
      const result = await constructionService.createSection(projectId, sectionData);
      await loadSections(projectId);
      return result;
    } catch (error) {
      console.error('Error creating section:', error);
      throw error;
    }
  }, [loadSections]);

  // Update section
  const updateSection = useCallback(async (id, sectionData, projectId) => {
    try {
      const result = await constructionService.updateSection(id, sectionData);
      if (projectId) {
        await loadSections(projectId);
      }
      return result;
    } catch (error) {
      console.error('Error updating section:', error);
      throw error;
    }
  }, [loadSections]);

  // Delete section
  const deleteSection = useCallback(async (id, projectId) => {
    try {
      await constructionService.deleteSection(id);
      if (projectId) {
        await loadSections(projectId);
      }
      if (selectedSection?.id === id) {
        setSelectedSection(null);
      }
    } catch (error) {
      console.error('Error deleting section:', error);
      throw error;
    }
  }, [loadSections, selectedSection]);

  // =====================================================
  // SMETA ITEMS
  // =====================================================

  // Load items for a section
  const loadItems = useCallback(async (sectionId) => {
    try {
      const data = await constructionService.listItems(sectionId);
      setItems(data || []);
      return data;
    } catch (error) {
      console.error('Error loading smeta items:', error);
      setItems([]);
      throw error;
    }
  }, []);

  // Create item
  const createItem = useCallback(async (sectionId, itemData) => {
    try {
      const result = await constructionService.createItem(sectionId, itemData);
      await loadItems(sectionId);
      return result;
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
    }
  }, [loadItems]);

  // Update item
  const updateItem = useCallback(async (id, itemData, sectionId) => {
    try {
      const result = await constructionService.updateItem(id, itemData);
      if (sectionId) {
        await loadItems(sectionId);
      }
      return result;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  }, [loadItems]);

  // Delete item
  const deleteItem = useCallback(async (id, sectionId) => {
    try {
      await constructionService.deleteItem(id);
      if (sectionId) {
        await loadItems(sectionId);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  }, [loadItems]);

  // =====================================================
  // HELPERS
  // =====================================================

  // Get projects by status
  const getProjectsByStatus = useCallback((status) => {
    return projects.filter(p => p.status === status);
  }, [projects]);

  // Calculate project statistics
  const getProjectStats = useCallback(() => {
    return {
      total: projects.length,
      draft: projects.filter(p => p.status === PROJECT_STATUS.DRAFT).length,
      inProgress: projects.filter(p => p.status === PROJECT_STATUS.IN_PROGRESS).length,
      completed: projects.filter(p => p.status === PROJECT_STATUS.COMPLETED).length,
      totalContractAmount: projects.reduce((sum, p) => sum + (p.contract_amount?.Float64 || 0), 0),
      totalSmeta: projects.reduce((sum, p) => sum + (p.total_smeta || 0), 0),
    };
  }, [projects]);

  // Calculate section totals
  const getSectionTotals = useCallback(() => {
    return sections.reduce((acc, section) => ({
      totalLaborCost: acc.totalLaborCost + (section.total_labor_cost || 0),
      totalMaterialCost: acc.totalMaterialCost + (section.total_material_cost || 0),
      totalEquipmentCost: acc.totalEquipmentCost + (section.total_equipment_cost || 0),
      totalCost: acc.totalCost + (section.total_cost || 0),
    }), {
      totalLaborCost: 0,
      totalMaterialCost: 0,
      totalEquipmentCost: 0,
      totalCost: 0,
    });
  }, [sections]);

  const value = {
    // State
    projects,
    selectedProject,
    setSelectedProject,
    sections,
    selectedSection,
    setSelectedSection,
    items,
    loading,
    projectDashboard,

    // Constants
    PROJECT_STATUS,
    PROJECT_TYPES,
    SMETA_STATUS,
    ITEM_STATUS,

    // Project methods
    loadProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    loadProjectDashboard,

    // Section methods
    loadSections,
    createSection,
    updateSection,
    deleteSection,

    // Item methods
    loadItems,
    createItem,
    updateItem,
    deleteItem,

    // Helpers
    getProjectsByStatus,
    getProjectStats,
    getSectionTotals,
  };

  return (
    <ConstructionContext.Provider value={value}>
      {children}
    </ConstructionContext.Provider>
  );
};

export default ConstructionContext;
