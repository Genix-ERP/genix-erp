// Export all API services
export { default as authService } from './auth';
export { default as activityService } from './activity';
export { default as contactsService } from './contacts';
export { default as inventoryService, fetchAllPages } from './inventory';
export { default as financeService } from './finance';
export { default as salesService } from './sales';
export { default as procurementService } from './procurement';
export { default as paymentTermsService } from './paymentTerms';
export { default as pricelistsService } from './pricelists';
export { default as quotationTemplatesService } from './quotationTemplates';
export { default as hrService } from './hr';
export { default as taskBoardsService } from './taskBoards';
export { default as contractsService } from './contracts';
export { default as aiService } from './ai';
export { default as pbxService } from './pbx';
export { default as leadsService } from './leads';
export { default as intercompanyService } from './intercompany';

// CRM Services
export {
  opportunitiesService,
  pipelineStagesService,
  pipelinesService,
  lostReasonsService,
  crmReportsService,
  activitiesService,
  tasksService,
  leadConversionService
} from './crm';
export { default as crmService } from './crm';

// Manufacturing Services
export {
  workCentersService,
  productionOrdersService,
  workOrdersService,
  bomsService,
  manufacturingTransfersService,
  equipmentService,
  manufacturingCategoriesService,
  costCalculationsService
} from './manufacturing';

export { default as subscriptionService } from './subscription';
export { default as stockValuationService } from './stockValuation';
// Re-export the API client
export { default as apiClient } from '../client';
export { setTokens, clearTokens, getAccessToken, getRefreshToken } from '../client';
