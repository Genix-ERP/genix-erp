// AI Analytics Service - Provides intelligent analysis of business data

// Translations for AI insights
const aiTranslations = {
  en: {
    // Sales
    noSalesData: "No sales data available yet.",
    revenueGrowing: "Revenue Growing",
    salesRevenueIncreased: (rate) => `Sales revenue increased by ${rate}% compared to last month`,
    revenueDeclining: "Revenue Declining",
    salesRevenueDecreased: (rate) => `Sales revenue decreased by ${rate}% compared to last month`,
    outstandingPayments: "Outstanding Payments",
    ordersUnpaid: (count, total) => `${count} orders totaling $${total} are unpaid`,
    pendingQuotations: "Pending Quotations",
    quotationsAwaiting: (count) => `${count} quotations awaiting customer confirmation`,
    focusTopCustomers: "Focus on Top Customers",
    topCustomerGenerates: (name, revenue) => `Your top customer ${name} generates $${revenue}. Consider loyalty programs.`,
    followUpPayments: "Follow Up on Payments",
    sendPaymentReminders: (count) => `Send payment reminders for ${count} unpaid orders`,
    increaseOrderValue: "Increase Order Value",
    avgOrderValueLow: (avg) => `Average order value is $${avg}. Consider upselling or bundle offers.`,

    // Inventory
    noInventoryData: "No inventory data available.",
    lowStockAlert: "Low Stock Alert",
    itemsBelowReorder: (count) => `${count} items are below reorder level`,
    deadStockDetected: "Dead Stock Detected",
    itemsNotMoving: (count, value) => `${count} items worth $${value} are not moving`,
    itemsExpiringSoon: "Items Expiring Soon",
    willExpireWithin: (count) => `${count} items will expire within 30 days`,
    overstockItems: "Overstock Items",
    itemsOverstocked: (count) => `${count} items are overstocked - consider promotions`,
    generatePurchaseOrders: "Generate Purchase Orders",
    createPOsFor: (count) => `Create POs for ${count} low stock items to prevent stockouts`,
    liquidateDeadStock: "Liquidate Dead Stock",
    considerPromotional: "Consider promotional pricing or bundle deals to move dead stock",
    prioritizeAClass: "Prioritize A-Class Items",
    aClassContribute: (count) => `${count} A-class items contribute most to revenue. Ensure adequate stock levels.`,

    // Financial
    noFinancialData: "No financial data available.",
    healthyProfitMargin: "Healthy Profit Margin",
    profitMarginAbove: (margin) => `Your profit margin of ${margin}% is above industry average`,
    lowProfitMargin: "Low Profit Margin",
    profitMarginBelow: (margin) => `Profit margin of ${margin}% is below optimal levels`,
    operatingAtLoss: "Operating at Loss",
    expensesExceedIncome: "Expenses exceed income - immediate action needed",
    expenseConcentration: "Expense Concentration",
    categoryAccountsFor: (cat, pct) => `${cat} accounts for ${pct}% of expenses`,
    reviewExpenseCategories: "Review Expense Categories",
    analyzeTopExpense: "Analyze top expense categories for potential cost reduction",
    cashFlowForecast: "Cash Flow Forecast",
    projectNextMonth: "Based on current trends, project next month cash position",

    // HR
    noEmployeeData: "No employee data available.",
    turnoverRiskAlert: "Turnover Risk Alert",
    employeesHighRisk: (count) => `${count} employees are at high risk of leaving`,
    highPerformanceTeam: "High Performance Team",
    avgPerformanceAbove: (avg) => `Average performance score of ${avg} is excellent`,
    performanceIssues: "Performance Issues",
    employeesBelow: (count) => `${count} employees need performance improvement`,
    retainKeyTalent: "Retain Key Talent",
    engageHighRisk: "Engage with high-risk employees to understand their concerns",
    performanceReviews: "Schedule Performance Reviews",
    considerReviews: (count) => `${count} employees due for performance review`,

    // Projects
    noProjectData: "No project data available.",
    onTimeDelivery: "On-Time Delivery",
    projectsOnTrack: (count) => `${count} projects are on track`,
    atRiskProjects: "At-Risk Projects",
    projectsBehind: (count) => `${count} projects are behind schedule`,
    budgetOverrun: "Budget Overrun",
    projectsOverBudget: (count) => `${count} projects exceeded budget`,
    reviewProjectTimelines: "Review Project Timelines",
    addressDelays: "Address delays in at-risk projects",
    resourceAllocation: "Optimize Resource Allocation",
    redistributeResources: "Consider redistributing resources from completed projects",

    // CRM
    noCRMData: "No CRM data available.",
    highValueLeads: "High-Value Leads",
    leadsAbove: (count, value) => `${count} leads with potential value above $${value}`,
    stagnantLeads: "Stagnant Leads",
    leadsNoActivity: (count) => `${count} leads haven't been contacted in 30+ days`,
    conversionOpportunity: "Conversion Opportunity",
    qualifiedLeads: (count) => `${count} qualified leads ready for closing`,
    followUpStagnant: "Follow Up on Stagnant Leads",
    reachOutTo: (count) => `Reach out to ${count} inactive leads`,
    focusQualified: "Focus on Qualified Leads",
    prioritizeQualified: "Prioritize qualified leads for faster conversion",

    // Manufacturing
    noManufacturingData: "No manufacturing data available.",
    delayedOrders: "Delayed Orders",
    ordersPastDue: (count) => `${count} work orders are past due date`,
    highProductionEfficiency: "High Production Efficiency",
    productionEfficiencyAt: (rate) => `Production efficiency is at ${rate}%`,
    highWorkLoad: "High Work Load",
    ordersInProgress: (count) => `${count} orders currently in progress`,
    prioritizeDelayed: "Prioritize Delayed Orders",
    allocateResources: "Allocate resources to complete overdue work orders",
    optimizeScheduling: "Optimize Scheduling",
    reviewProduction: "Review production schedule for bottlenecks",
    predictiveMaintenance: "Predictive Maintenance",
    scheduleMaintenance: "Schedule maintenance based on equipment usage patterns",

    // Procurement
    noProcurementData: "No procurement data available.",
    pendingOrders: "Pending Orders",
    ordersAwaiting: (count) => `${count} purchase orders awaiting fulfillment`,
    vendorConcentration: "Vendor Concentration",
    vendorRepresents: (name, pct) => `${name} represents ${pct}% of spend`,
    diversifySuppliers: "Diversify Suppliers",
    addBackupVendors: "Consider adding backup vendors to reduce risk",
    negotiateBulkPricing: "Negotiate Bulk Pricing",
    leverageVolume: "Leverage volume with top vendors for better rates",

    // Assets
    noAssetData: "No asset data available.",
    maintenanceDue: "Maintenance Due",
    assetsRequireMaintenance: (count) => `${count} assets require maintenance within 30 days`,
    fullyDepreciated: "Fully Depreciated",
    assetsFullyDepreciated: (count) => `${count} assets are fully depreciated`,
    netBookValue: "Net Book Value",
    currentValueAfter: "Current value of all assets after depreciation",
    scheduleMaintenance2: "Schedule Maintenance",
    planMaintenance: (count) => `Plan maintenance for ${count} assets`,
    assetReplacementPlan: "Asset Replacement Plan",
    considerReplacement: "Consider replacement strategy for aging assets",

    // Expenses
    noExpenseData: "No expense data available.",
    pendingApprovals: "Pending Approvals",
    expensesAwaiting: (count, amount) => `${count} expenses totaling $${amount} awaiting approval`,
    topExpenseCategory: "Top Expense Category",
    largestExpense: (cat, lang) => `${translateCategory(cat, lang || 'en')} is your largest expense category`,
    highRejectionRate: "High Rejection Rate",
    expensesRejected: (rate) => `${rate}% of expenses are being rejected`,
    reviewPendingExpenses: "Review Pending Expenses",
    clearBacklog: "Clear backlog of expense approvals",
    setCategoryBudgets: "Set Category Budgets",
    establishLimits: "Establish spending limits by category",

    // Payroll
    noPayrollData: "No payroll data available.",
    pendingPayroll: "Pending Payroll",
    payrollPending: (count) => `${count} payroll records pending processing`,
    totalPayrollCost: "Total Payroll Cost",
    grossPayroll: "Gross payroll for current period",
    deductionRate: "Deduction Rate",
    ofGrossSalary: (rate) => `${rate}% of gross salary goes to deductions`,
    processPendingPayroll: "Process Pending Payroll",
    completeProcessing: "Complete payroll processing before due date",
    reviewTaxCompliance: "Review Tax Compliance",
    ensureWithholdings: "Ensure all tax withholdings are accurate",

    // Contracts
    noContractData: "No contract data available.",
    contractsExpiringSoon: "Contracts Expiring Soon",
    contractsExpire: (count) => `${count} contracts expire within 30 days`,
    activeContractValue: "Active Contract Value",
    totalValueActive: "Total value of active contracts",
    activeContracts: "Active Contracts",
    contractsActive: (count) => `${count} contracts currently active`,
    contractsSummary: (count, value) => `${count} Active | $${value} Value`,
    initiateRenewals: "Initiate Renewals",
    startRenewalProcess: (count) => `Start renewal process for ${count} expiring contracts`,
    contractReview: "Contract Review",
    regularlyReview: "Regularly review contract terms and compliance"
  },
  uz: {
    // Sales
    noSalesData: "Savdo ma'lumotlari mavjud emas.",
    revenueGrowing: "Daromad o'sishi",
    salesRevenueIncreased: (rate) => `Savdo daromadi o'tgan oyga nisbatan ${rate}% oshdi`,
    revenueDeclining: "Daromad pasayishi",
    salesRevenueDecreased: (rate) => `Savdo daromadi o'tgan oyga nisbatan ${rate}% kamaydi`,
    outstandingPayments: "To'lanmagan to'lovlar",
    ordersUnpaid: (count, total) => `${count} ta buyurtma, jami $${total} to'lanmagan`,
    pendingQuotations: "Kutilayotgan taklifnomalar",
    quotationsAwaiting: (count) => `${count} ta taklifnoma mijoz tasdig'ini kutmoqda`,
    focusTopCustomers: "Top mijozlarga e'tibor",
    topCustomerGenerates: (name, revenue) => `Sizning eng yaxshi mijozingiz ${name} $${revenue} keltiradi. Sodiqlik dasturlarini ko'rib chiqing.`,
    followUpPayments: "To'lovlarni kuzatish",
    sendPaymentReminders: (count) => `${count} ta to'lanmagan buyurtma uchun eslatma yuboring`,
    increaseOrderValue: "Buyurtma qiymatini oshirish",
    avgOrderValueLow: (avg) => `O'rtacha buyurtma qiymati $${avg}. Upselling yoki paketli takliflarni ko'rib chiqing.`,

    // Inventory
    noInventoryData: "Inventar ma'lumotlari mavjud emas.",
    lowStockAlert: "Kam zaxira ogohlantirishi",
    itemsBelowReorder: (count) => `${count} ta mahsulot qayta buyurtma darajasidan past`,
    deadStockDetected: "O'lik zaxira aniqlandi",
    itemsNotMoving: (count, value) => `${count} ta mahsulot, qiymati $${value}, sotilmayapti`,
    itemsExpiringSoon: "Tez orada muddati tugaydi",
    willExpireWithin: (count) => `${count} ta mahsulot 30 kun ichida muddati tugaydi`,
    overstockItems: "Ortiqcha zaxira",
    itemsOverstocked: (count) => `${count} ta mahsulot ortiqcha - aksiyalarni ko'rib chiqing`,
    generatePurchaseOrders: "Xarid buyurtmalarini yaratish",
    createPOsFor: (count) => `Zaxira tugashining oldini olish uchun ${count} ta kam zaxira mahsuloti uchun buyurtma yarating`,
    liquidateDeadStock: "O'lik zaxirani sotish",
    considerPromotional: "O'lik zaxirani sotish uchun aksiya narxlarini ko'rib chiqing",
    prioritizeAClass: "A-sinf mahsulotlariga e'tibor",
    aClassContribute: (count) => `${count} ta A-sinf mahsuloti eng ko'p daromad keltiradi. Yetarli zaxirani ta'minlang.`,

    // Financial
    noFinancialData: "Moliyaviy ma'lumotlar mavjud emas.",
    healthyProfitMargin: "Sog'lom foyda marjasi",
    profitMarginAbove: (margin) => `Sizning foyda marjangiz ${margin}% sohaviy o'rtachadan yuqori`,
    lowProfitMargin: "Past foyda marjasi",
    profitMarginBelow: (margin) => `${margin}% foyda marjasi optimal darajadan past`,
    operatingAtLoss: "Zarar bilan ishlash",
    expensesExceedIncome: "Xarajatlar daromaddan oshib ketdi - tezkor choralar kerak",
    expenseConcentration: "Xarajatlar kontsentratsiyasi",
    categoryAccountsFor: (cat, pct) => `${cat} xarajatlarning ${pct}%ini tashkil qiladi`,
    reviewExpenseCategories: "Xarajat toifalarini ko'rib chiqish",
    analyzeTopExpense: "Xarajatlarni kamaytirish uchun yuqori xarajat toifalarini tahlil qiling",
    cashFlowForecast: "Pul oqimi prognozi",
    projectNextMonth: "Joriy tendentsiyalarga asoslanib kelasi oy pul holatini prognoz qiling",

    // HR
    noEmployeeData: "Xodimlar ma'lumotlari mavjud emas.",
    turnoverRiskAlert: "Kadrlar almashinuvi xavfi",
    employeesHighRisk: (count) => `${count} ta xodim ketish xavfi yuqori`,
    highPerformanceTeam: "Yuqori samaradorlik",
    avgPerformanceAbove: (avg) => `O'rtacha samaradorlik balli ${avg} a'lo`,
    performanceIssues: "Samaradorlik muammolari",
    employeesBelow: (count) => `${count} ta xodim samaradorlikni oshirishi kerak`,
    retainKeyTalent: "Asosiy iste'dodlarni saqlash",
    engageHighRisk: "Yuqori xavfli xodimlar bilan muloqot qiling",
    performanceReviews: "Samaradorlik baholashlarini rejalashtirish",
    considerReviews: (count) => `${count} ta xodim samaradorlik baholashiga muhtoj`,

    // Projects
    noProjectData: "Loyiha ma'lumotlari mavjud emas.",
    onTimeDelivery: "O'z vaqtida yetkazish",
    projectsOnTrack: (count) => `${count} ta loyiha rejada`,
    atRiskProjects: "Xavf ostidagi loyihalar",
    projectsBehind: (count) => `${count} ta loyiha jadvaldan orqada`,
    budgetOverrun: "Byudjet oshishi",
    projectsOverBudget: (count) => `${count} ta loyiha byudjetdan oshdi`,
    reviewProjectTimelines: "Loyiha muddatlarini ko'rib chiqish",
    addressDelays: "Xavf ostidagi loyihalardagi kechikishlarni bartaraf eting",
    resourceAllocation: "Resurslarni taqsimlashni optimallashtirish",
    redistributeResources: "Tugallangan loyihalardan resurslarni qayta taqsimlashni ko'rib chiqing",

    // CRM
    noCRMData: "CRM ma'lumotlari mavjud emas.",
    highValueLeads: "Yuqori qiymatli lidlar",
    leadsAbove: (count, value) => `${count} ta lid potentsial qiymati $${value}dan yuqori`,
    stagnantLeads: "Faol bo'lmagan lidlar",
    leadsNoActivity: (count) => `${count} ta lid 30+ kun davomida aloqa qilinmagan`,
    conversionOpportunity: "Konversiya imkoniyati",
    qualifiedLeads: (count) => `${count} ta malakali lid yopishga tayyor`,
    followUpStagnant: "Faol bo'lmagan lidlarni kuzatish",
    reachOutTo: (count) => `${count} ta nofaol lid bilan bog'laning`,
    focusQualified: "Malakali lidlarga e'tibor",
    prioritizeQualified: "Tezroq konversiya uchun malakali lidlarni birinchi o'ringa qo'ying",

    // Manufacturing
    noManufacturingData: "Ishlab chiqarish ma'lumotlari mavjud emas.",
    delayedOrders: "Kechiktirilgan buyurtmalar",
    ordersPastDue: (count) => `${count} ta ish buyurtmasi muddati o'tgan`,
    highProductionEfficiency: "Yuqori ishlab chiqarish samaradorligi",
    productionEfficiencyAt: (rate) => `Ishlab chiqarish samaradorligi ${rate}%`,
    highWorkLoad: "Yuqori ish yuki",
    ordersInProgress: (count) => `${count} ta buyurtma hozirda bajarilmoqda`,
    prioritizeDelayed: "Kechikkan buyurtmalarni birinchi o'ringa qo'yish",
    allocateResources: "Muddati o'tgan ish buyurtmalarini bajarish uchun resurslarni taqsimlang",
    optimizeScheduling: "Jadvallashtirish optimizatsiyasi",
    reviewProduction: "Ishlab chiqarish jadvalini to'siqlar uchun ko'rib chiqing",
    predictiveMaintenance: "Bashoratli texnik xizmat",
    scheduleMaintenance: "Uskunadan foydalanish ko'rsatkichlariga asoslanib texnik xizmatni rejalashtiring",

    // Procurement
    noProcurementData: "Xaridlar ma'lumotlari mavjud emas.",
    pendingOrders: "Kutilayotgan buyurtmalar",
    ordersAwaiting: (count) => `${count} ta xarid buyurtmasi bajarilishini kutmoqda`,
    vendorConcentration: "Yetkazib beruvchi kontsentratsiyasi",
    vendorRepresents: (name, pct) => `${name} xarajatlarning ${pct}%ini tashkil qiladi`,
    diversifySuppliers: "Yetkazib beruvchilarni diversifikatsiya qilish",
    addBackupVendors: "Xavfni kamaytirish uchun zaxira yetkazib beruvchilarni qo'shishni ko'rib chiqing",
    negotiateBulkPricing: "Ko'p miqdor uchun narxni muhokama qilish",
    leverageVolume: "Yaxshiroq narxlar uchun asosiy yetkazib beruvchilar bilan hajmdan foydalaning",

    // Assets
    noAssetData: "Aktivlar ma'lumotlari mavjud emas.",
    maintenanceDue: "Texnik xizmat muddati",
    assetsRequireMaintenance: (count) => `${count} ta aktiv 30 kun ichida texnik xizmatga muhtoj`,
    fullyDepreciated: "To'liq amortizatsiya qilingan",
    assetsFullyDepreciated: (count) => `${count} ta aktiv to'liq amortizatsiya qilingan`,
    netBookValue: "Sof balans qiymati",
    currentValueAfter: "Amortizatsiyadan keyin barcha aktivlarning joriy qiymati",
    scheduleMaintenance2: "Texnik xizmatni rejalashtirish",
    planMaintenance: (count) => `${count} ta aktiv uchun texnik xizmatni rejalashtiring`,
    assetReplacementPlan: "Aktivlarni almashtirish rejasi",
    considerReplacement: "Eskirgan aktivlar uchun almashtirish strategiyasini ko'rib chiqing",

    // Expenses
    noExpenseData: "Xarajatlar ma'lumotlari mavjud emas.",
    pendingApprovals: "Kutilayotgan tasdiqlar",
    expensesAwaiting: (count, amount) => `${count} ta xarajat, jami $${amount} tasdiqlashni kutmoqda`,
    topExpenseCategory: "Eng katta xarajat toifasi",
    largestExpense: (cat, lang) => `${translateCategory(cat, lang || 'uz')} sizning eng katta xarajat toifangiz`,
    highRejectionRate: "Yuqori rad etish darajasi",
    expensesRejected: (rate) => `Xarajatlarning ${rate}%i rad etilmoqda`,
    reviewPendingExpenses: "Kutilayotgan xarajatlarni ko'rib chiqish",
    clearBacklog: "Xarajat tasdiqlarining ortda qolgan ishlarini tozalang",
    setCategoryBudgets: "Toifa byudjetlarini belgilash",
    establishLimits: "Toifa bo'yicha xarajat chegaralarini belgilang",

    // Payroll
    noPayrollData: "Ish haqi ma'lumotlari mavjud emas.",
    pendingPayroll: "Kutilayotgan ish haqi",
    payrollPending: (count) => `${count} ta ish haqi yozuvi qayta ishlashni kutmoqda`,
    totalPayrollCost: "Umumiy ish haqi xarajati",
    grossPayroll: "Joriy davr uchun yalpi ish haqi",
    deductionRate: "Ushlab qolish darajasi",
    ofGrossSalary: (rate) => `Yalpi ish haqining ${rate}%i ushlab qolinadi`,
    processPendingPayroll: "Kutilayotgan ish haqini qayta ishlash",
    completeProcessing: "Muddatidan oldin ish haqi qayta ishlashni yakunlang",
    reviewTaxCompliance: "Soliq muvofiqligini tekshirish",
    ensureWithholdings: "Barcha soliq ushlab qolishlari to'g'ri ekanligiga ishonch hosil qiling",

    // Contracts
    noContractData: "Shartnomalar ma'lumotlari mavjud emas.",
    contractsExpiringSoon: "Tez orada tugaydigan shartnomalar",
    contractsExpire: (count) => `${count} ta shartnoma 30 kun ichida tugaydi`,
    activeContractValue: "Faol shartnomalar qiymati",
    totalValueActive: "Faol shartnomalarning umumiy qiymati",
    activeContracts: "Faol shartnomalar",
    contractsActive: (count) => `${count} ta shartnoma hozirda faol`,
    contractsSummary: (count, value) => `${count} Faol | $${value} Qiymat`,
    initiateRenewals: "Yangilashni boshlash",
    startRenewalProcess: (count) => `${count} ta tugayotgan shartnoma uchun yangilash jarayonini boshlang`,
    contractReview: "Shartnomalarni ko'rib chiqish",
    regularlyReview: "Shartnoma shartlari va muvofiqligini muntazam ko'rib chiqing"
  },
  ru: {
    // Sales
    noSalesData: "Данные о продажах недоступны.",
    revenueGrowing: "Рост выручки",
    salesRevenueIncreased: (rate) => `Выручка от продаж выросла на ${rate}% по сравнению с прошлым месяцем`,
    revenueDeclining: "Снижение выручки",
    salesRevenueDecreased: (rate) => `Выручка от продаж снизилась на ${rate}% по сравнению с прошлым месяцем`,
    outstandingPayments: "Неоплаченные платежи",
    ordersUnpaid: (count, total) => `${count} заказов на сумму $${total} не оплачены`,
    pendingQuotations: "Ожидающие предложения",
    quotationsAwaiting: (count) => `${count} предложений ожидают подтверждения клиента`,
    focusTopCustomers: "Фокус на ключевых клиентах",
    topCustomerGenerates: (name, revenue) => `Ваш лучший клиент ${name} приносит $${revenue}. Рассмотрите программы лояльности.`,
    followUpPayments: "Отслеживание платежей",
    sendPaymentReminders: (count) => `Отправьте напоминания об оплате для ${count} неоплаченных заказов`,
    increaseOrderValue: "Увеличение стоимости заказа",
    avgOrderValueLow: (avg) => `Средняя стоимость заказа $${avg}. Рассмотрите допродажи или пакетные предложения.`,

    // Inventory
    noInventoryData: "Данные об инвентаре недоступны.",
    lowStockAlert: "Предупреждение о низком запасе",
    itemsBelowReorder: (count) => `${count} товаров ниже уровня перезаказа`,
    deadStockDetected: "Обнаружен мёртвый запас",
    itemsNotMoving: (count, value) => `${count} товаров на сумму $${value} не продаются`,
    itemsExpiringSoon: "Скоро истекает срок",
    willExpireWithin: (count) => `У ${count} товаров срок годности истекает в течение 30 дней`,
    overstockItems: "Избыточный запас",
    itemsOverstocked: (count) => `${count} товаров в избытке - рассмотрите акции`,
    generatePurchaseOrders: "Создать заказы на закупку",
    createPOsFor: (count) => `Создайте заказы для ${count} товаров с низким запасом`,
    liquidateDeadStock: "Ликвидация мёртвого запаса",
    considerPromotional: "Рассмотрите акционные цены для продажи мёртвого запаса",
    prioritizeAClass: "Приоритет товарам класса A",
    aClassContribute: (count) => `${count} товаров класса A приносят наибольший доход. Обеспечьте достаточный запас.`,

    // Financial
    noFinancialData: "Финансовые данные недоступны.",
    healthyProfitMargin: "Здоровая маржа прибыли",
    profitMarginAbove: (margin) => `Ваша маржа прибыли ${margin}% выше среднеотраслевой`,
    lowProfitMargin: "Низкая маржа прибыли",
    profitMarginBelow: (margin) => `Маржа прибыли ${margin}% ниже оптимального уровня`,
    operatingAtLoss: "Работа в убыток",
    expensesExceedIncome: "Расходы превышают доходы - требуются срочные меры",
    expenseConcentration: "Концентрация расходов",
    categoryAccountsFor: (cat, pct) => `${cat} составляет ${pct}% расходов`,
    reviewExpenseCategories: "Анализ категорий расходов",
    analyzeTopExpense: "Проанализируйте основные категории расходов для сокращения затрат",
    cashFlowForecast: "Прогноз денежного потока",
    projectNextMonth: "На основе текущих тенденций спрогнозируйте денежную позицию на следующий месяц",

    // HR
    noEmployeeData: "Данные о сотрудниках недоступны.",
    turnoverRiskAlert: "Предупреждение о риске текучести",
    employeesHighRisk: (count) => `${count} сотрудников с высоким риском увольнения`,
    highPerformanceTeam: "Высокоэффективная команда",
    avgPerformanceAbove: (avg) => `Средняя оценка производительности ${avg} - отлично`,
    performanceIssues: "Проблемы с производительностью",
    employeesBelow: (count) => `${count} сотрудников нуждаются в улучшении показателей`,
    retainKeyTalent: "Удержание ключевых талантов",
    engageHighRisk: "Проведите беседы с сотрудниками группы риска",
    performanceReviews: "Оценка производительности",
    considerReviews: (count) => `${count} сотрудников требуют оценки производительности`,

    // Projects
    noProjectData: "Данные о проектах недоступны.",
    onTimeDelivery: "Своевременная доставка",
    projectsOnTrack: (count) => `${count} проектов идут по плану`,
    atRiskProjects: "Проекты под угрозой",
    projectsBehind: (count) => `${count} проектов отстают от графика`,
    budgetOverrun: "Превышение бюджета",
    projectsOverBudget: (count) => `${count} проектов превысили бюджет`,
    reviewProjectTimelines: "Анализ сроков проектов",
    addressDelays: "Устраните задержки в проектах под угрозой",
    resourceAllocation: "Оптимизация распределения ресурсов",
    redistributeResources: "Рассмотрите перераспределение ресурсов из завершённых проектов",

    // CRM
    noCRMData: "Данные CRM недоступны.",
    highValueLeads: "Ценные лиды",
    leadsAbove: (count, value) => `${count} лидов с потенциалом выше $${value}`,
    stagnantLeads: "Застойные лиды",
    leadsNoActivity: (count) => `${count} лидов не контактировались более 30 дней`,
    conversionOpportunity: "Возможность конверсии",
    qualifiedLeads: (count) => `${count} квалифицированных лидов готовы к закрытию`,
    followUpStagnant: "Работа с застойными лидами",
    reachOutTo: (count) => `Свяжитесь с ${count} неактивными лидами`,
    focusQualified: "Фокус на квалифицированных лидах",
    prioritizeQualified: "Приоритизируйте квалифицированных лидов для быстрой конверсии",

    // Manufacturing
    noManufacturingData: "Данные о производстве недоступны.",
    delayedOrders: "Задержанные заказы",
    ordersPastDue: (count) => `${count} рабочих заказов просрочены`,
    highProductionEfficiency: "Высокая эффективность производства",
    productionEfficiencyAt: (rate) => `Эффективность производства составляет ${rate}%`,
    highWorkLoad: "Высокая загрузка",
    ordersInProgress: (count) => `${count} заказов в процессе выполнения`,
    prioritizeDelayed: "Приоритет задержанным заказам",
    allocateResources: "Выделите ресурсы для завершения просроченных заказов",
    optimizeScheduling: "Оптимизация планирования",
    reviewProduction: "Проверьте график производства на узкие места",
    predictiveMaintenance: "Предиктивное обслуживание",
    scheduleMaintenance: "Запланируйте обслуживание на основе использования оборудования",

    // Procurement
    noProcurementData: "Данные о закупках недоступны.",
    pendingOrders: "Ожидающие заказы",
    ordersAwaiting: (count) => `${count} заказов ожидают выполнения`,
    vendorConcentration: "Концентрация поставщиков",
    vendorRepresents: (name, pct) => `${name} составляет ${pct}% расходов`,
    diversifySuppliers: "Диверсификация поставщиков",
    addBackupVendors: "Рассмотрите добавление резервных поставщиков",
    negotiateBulkPricing: "Переговоры об оптовых ценах",
    leverageVolume: "Используйте объём для получения лучших цен",

    // Assets
    noAssetData: "Данные об активах недоступны.",
    maintenanceDue: "Требуется обслуживание",
    assetsRequireMaintenance: (count) => `${count} активов требуют обслуживания в течение 30 дней`,
    fullyDepreciated: "Полностью амортизированы",
    assetsFullyDepreciated: (count) => `${count} активов полностью амортизированы`,
    netBookValue: "Чистая балансовая стоимость",
    currentValueAfter: "Текущая стоимость всех активов после амортизации",
    scheduleMaintenance2: "Планирование обслуживания",
    planMaintenance: (count) => `Запланируйте обслуживание для ${count} активов`,
    assetReplacementPlan: "План замены активов",
    considerReplacement: "Рассмотрите стратегию замены устаревших активов",

    // Expenses
    noExpenseData: "Данные о расходах недоступны.",
    pendingApprovals: "Ожидающие одобрения",
    expensesAwaiting: (count, amount) => `${count} расходов на сумму $${amount} ожидают одобрения`,
    topExpenseCategory: "Основная категория расходов",
    largestExpense: (cat, lang) => `${translateCategory(cat, lang || 'ru')} - ваша крупнейшая категория расходов`,
    highRejectionRate: "Высокий процент отклонений",
    expensesRejected: (rate) => `${rate}% расходов отклоняются`,
    reviewPendingExpenses: "Проверка ожидающих расходов",
    clearBacklog: "Очистите очередь на одобрение расходов",
    setCategoryBudgets: "Установка бюджетов по категориям",
    establishLimits: "Установите лимиты расходов по категориям",

    // Payroll
    noPayrollData: "Данные о зарплате недоступны.",
    pendingPayroll: "Ожидающая зарплата",
    payrollPending: (count) => `${count} записей о зарплате ожидают обработки`,
    totalPayrollCost: "Общие затраты на зарплату",
    grossPayroll: "Валовая зарплата за текущий период",
    deductionRate: "Ставка удержаний",
    ofGrossSalary: (rate) => `${rate}% валовой зарплаты идёт на удержания`,
    processPendingPayroll: "Обработка ожидающей зарплаты",
    completeProcessing: "Завершите обработку зарплаты до срока",
    reviewTaxCompliance: "Проверка налогового соответствия",
    ensureWithholdings: "Убедитесь в правильности всех налоговых удержаний",

    // Contracts
    noContractData: "Данные о контрактах недоступны.",
    contractsExpiringSoon: "Контракты скоро истекают",
    contractsExpire: (count) => `${count} контрактов истекают в течение 30 дней`,
    activeContractValue: "Стоимость активных контрактов",
    totalValueActive: "Общая стоимость активных контрактов",
    activeContracts: "Активные контракты",
    contractsActive: (count) => `${count} контрактов активны`,
    contractsSummary: (count, value) => `${count} Активных | $${value} Стоимость`,
    initiateRenewals: "Начать продление",
    startRenewalProcess: (count) => `Начните процесс продления для ${count} истекающих контрактов`,
    contractReview: "Проверка контрактов",
    regularlyReview: "Регулярно проверяйте условия и соответствие контрактов"
  }
};

// Helper to get translations
const getT = (language = 'en') => aiTranslations[language] || aiTranslations.en;

// Helper to translate category names
const translateCategory = (category, language = 'en') => {
  const categoryTranslations = {
    en: {
      travel: 'Travel',
      meals: 'Meals',
      office_supplies: 'Office Supplies',
      equipment: 'Equipment',
      utilities: 'Utilities',
      marketing: 'Marketing',
      other: 'Other'
    },
    uz: {
      travel: 'Safar',
      meals: 'Ovqat',
      office_supplies: 'Ofis anjomlari',
      equipment: 'Uskunalar',
      utilities: 'Kommunal xizmatlar',
      marketing: 'Marketing',
      other: 'Boshqa'
    },
    ru: {
      travel: 'Командировки',
      meals: 'Питание',
      office_supplies: 'Офисные принадлежности',
      equipment: 'Оборудование',
      utilities: 'Коммунальные услуги',
      marketing: 'Маркетинг',
      other: 'Прочее'
    }
  };

  const translations = categoryTranslations[language] || categoryTranslations.en;
  return translations[category] || category;
};

/**
 * Analyzes sales data and provides insights
 */
export const analyzeSales = (salesOrders, customers = [], language = 'en') => {
  const t = getT(language);
  if (!salesOrders || salesOrders.length === 0) {
    return {
      summary: t.noSalesData,
      insights: [],
      recommendations: []
    };
  }

  const totalRevenue = salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const avgOrderValue = totalRevenue / salesOrders.length;

  // Status breakdown
  const statusCounts = salesOrders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  // Monthly trends
  const monthlyData = {};
  salesOrders.forEach(o => {
    const month = new Date(o.order_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (!monthlyData[month]) monthlyData[month] = { count: 0, revenue: 0 };
    monthlyData[month].count++;
    monthlyData[month].revenue += o.total_amount || 0;
  });

  const months = Object.keys(monthlyData);
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];

  let growthRate = 0;
  if (lastMonth && prevMonth && monthlyData[prevMonth].revenue > 0) {
    growthRate = ((monthlyData[lastMonth].revenue - monthlyData[prevMonth].revenue) / monthlyData[prevMonth].revenue) * 100;
  }

  // Customer analysis
  const customerRevenue = {};
  salesOrders.forEach(o => {
    if (o.customer_name) {
      customerRevenue[o.customer_name] = (customerRevenue[o.customer_name] || 0) + (o.total_amount || 0);
    }
  });

  const topCustomers = Object.entries(customerRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, revenue]) => ({ name, revenue }));

  // Unpaid orders
  const unpaidOrders = salesOrders.filter(o => o.payment_status === 'unpaid');
  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Generate insights
  const insights = [];

  if (growthRate > 0) {
    insights.push({
      type: 'positive',
      title: t.revenueGrowing,
      description: t.salesRevenueIncreased(growthRate.toFixed(1)),
      metric: `+${growthRate.toFixed(1)}%`,
      priority: 'high'
    });
  } else if (growthRate < -5) {
    insights.push({
      type: 'warning',
      title: t.revenueDeclining,
      description: t.salesRevenueDecreased(Math.abs(growthRate).toFixed(1)),
      metric: `${growthRate.toFixed(1)}%`,
      priority: 'high'
    });
  }

  if (unpaidOrders.length > 0) {
    insights.push({
      type: 'warning',
      title: t.outstandingPayments,
      description: t.ordersUnpaid(unpaidOrders.length, unpaidTotal.toLocaleString()),
      metric: `$${unpaidTotal.toLocaleString()}`,
      priority: unpaidTotal > 10000 ? 'high' : 'medium'
    });
  }

  if (statusCounts.quotation > 2) {
    insights.push({
      type: 'info',
      title: t.pendingQuotations,
      description: t.quotationsAwaiting(statusCounts.quotation),
      metric: statusCounts.quotation,
      priority: 'medium'
    });
  }

  // Recommendations
  const recommendations = [];

  if (topCustomers.length > 0) {
    recommendations.push({
      action: t.focusTopCustomers,
      description: t.topCustomerGenerates(topCustomers[0].name, topCustomers[0].revenue.toLocaleString()),
      impact: 'high'
    });
  }

  if (unpaidOrders.length > 0) {
    recommendations.push({
      action: t.followUpPayments,
      description: t.sendPaymentReminders(unpaidOrders.length),
      impact: 'medium'
    });
  }

  if (avgOrderValue < 5000) {
    recommendations.push({
      action: t.increaseOrderValue,
      description: t.avgOrderValueLow(avgOrderValue.toFixed(0)),
      impact: 'medium'
    });
  }

  return {
    summary: `Total Revenue: $${totalRevenue.toLocaleString()} | ${salesOrders.length} Orders | Avg: $${avgOrderValue.toFixed(0)}`,
    metrics: {
      totalRevenue,
      orderCount: salesOrders.length,
      avgOrderValue,
      growthRate,
      unpaidTotal
    },
    topCustomers,
    statusBreakdown: statusCounts,
    monthlyTrend: monthlyData,
    insights,
    recommendations
  };
};

/**
 * Analyzes inventory data and provides insights
 */
export const analyzeInventory = (items, movements = [], language = 'en') => {
  const t = getT(language);
  if (!items || items.length === 0) {
    return {
      summary: t.noInventoryData,
      insights: [],
      recommendations: []
    };
  }

  const totalValue = items.reduce((sum, i) => sum + (i.current_stock * (i.unit_cost || 0)), 0);
  const totalUnits = items.reduce((sum, i) => sum + (i.current_stock || 0), 0);

  // Stock status analysis
  const lowStockItems = items.filter(i => i.current_stock <= (i.reorder_level || 10));
  const deadStockItems = items.filter(i => i.status === 'dead_stock');
  const overstockItems = items.filter(i => i.status === 'overstock');

  // Expiring items (within 30 days)
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringItems = items.filter(i =>
    i.expiration_date && new Date(i.expiration_date) < thirtyDays
  );

  // Category breakdown
  const categoryData = {};
  items.forEach(i => {
    const cat = i.category || 'uncategorized';
    if (!categoryData[cat]) categoryData[cat] = { count: 0, value: 0 };
    categoryData[cat].count++;
    categoryData[cat].value += (i.current_stock * (i.unit_cost || 0));
  });

  // Costing method breakdown
  const costingMethods = items.reduce((acc, i) => {
    const method = i.costing_method || 'fifo';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {});

  // Generate insights
  const insights = [];

  if (lowStockItems.length > 0) {
    const lowStockValue = lowStockItems.reduce((sum, i) => sum + (i.current_stock * (i.unit_cost || 0)), 0);
    insights.push({
      type: 'warning',
      title: t.lowStockAlert,
      description: t.itemsBelowReorder(lowStockItems.length),
      metric: lowStockItems.length,
      items: lowStockItems.slice(0, 5).map(i => i.name),
      priority: lowStockItems.length > 3 ? 'high' : 'medium'
    });
  }

  if (deadStockItems.length > 0) {
    const deadStockValue = deadStockItems.reduce((sum, i) => sum + (i.current_stock * (i.unit_cost || 0)), 0);
    insights.push({
      type: 'negative',
      title: t.deadStockDetected,
      description: t.itemsNotMoving(deadStockItems.length, deadStockValue.toLocaleString()),
      metric: `$${deadStockValue.toLocaleString()}`,
      priority: 'high'
    });
  }

  if (expiringItems.length > 0) {
    insights.push({
      type: 'warning',
      title: t.itemsExpiringSoon,
      description: t.willExpireWithin(expiringItems.length),
      metric: expiringItems.length,
      items: expiringItems.slice(0, 5).map(i => i.name),
      priority: 'high'
    });
  }

  if (overstockItems.length > 0) {
    insights.push({
      type: 'info',
      title: t.overstockItems,
      description: t.itemsOverstocked(overstockItems.length),
      metric: overstockItems.length,
      priority: 'low'
    });
  }

  // Recommendations
  const recommendations = [];

  if (lowStockItems.length > 0) {
    recommendations.push({
      action: t.generatePurchaseOrders,
      description: t.createPOsFor(lowStockItems.length),
      items: lowStockItems.map(i => ({ name: i.name, sku: i.sku, current: i.current_stock, reorder: i.reorder_level })),
      impact: 'high'
    });
  }

  if (deadStockItems.length > 0) {
    recommendations.push({
      action: t.liquidateDeadStock,
      description: t.considerPromotional,
      impact: 'medium'
    });
  }

  // ABC Analysis recommendation
  const aItems = items.filter(i => i.abc_classification === 'A');
  if (aItems.length > 0) {
    recommendations.push({
      action: t.prioritizeAClass,
      description: t.aClassContribute(aItems.length),
      impact: 'high'
    });
  }

  return {
    summary: `Total Value: $${totalValue.toLocaleString()} | ${items.length} SKUs | ${totalUnits} Units`,
    metrics: {
      totalValue,
      totalSKUs: items.length,
      totalUnits,
      lowStockCount: lowStockItems.length,
      deadStockCount: deadStockItems.length,
      expiringCount: expiringItems.length
    },
    categoryBreakdown: categoryData,
    costingMethods,
    lowStockItems: lowStockItems.slice(0, 10),
    insights,
    recommendations
  };
};

/**
 * Analyzes financial data and provides insights
 */
export const analyzeFinancials = (transactions, invoices = [], expenses = [], language = 'en') => {
  const t = getT(language);
  if (!transactions || transactions.length === 0) {
    return {
      summary: t.noFinancialData,
      insights: [],
      recommendations: []
    };
  }

  const income = transactions.filter(t => t.transaction_type === 'income');
  const expenseTransactions = transactions.filter(t => t.transaction_type === 'expense');

  const totalIncome = income.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Monthly cash flow
  const monthlyFlow = {};
  transactions.forEach(t => {
    const month = new Date(t.date).toLocaleDateString('en-US', { month: 'short' });
    if (!monthlyFlow[month]) monthlyFlow[month] = { income: 0, expense: 0 };
    if (t.transaction_type === 'income') {
      monthlyFlow[month].income += t.amount || 0;
    } else {
      monthlyFlow[month].expense += t.amount || 0;
    }
  });

  // Category breakdown for expenses
  const expenseCategories = {};
  expenseTransactions.forEach(t => {
    const cat = t.category || 'other';
    expenseCategories[cat] = (expenseCategories[cat] || 0) + (t.amount || 0);
  });

  // Find largest expense category
  const largestExpenseCategory = Object.entries(expenseCategories)
    .sort((a, b) => b[1] - a[1])[0];

  // Generate insights
  const insights = [];

  if (profitMargin > 20) {
    insights.push({
      type: 'positive',
      title: t.healthyProfitMargin,
      description: t.profitMarginAbove(profitMargin.toFixed(1)),
      metric: `${profitMargin.toFixed(1)}%`,
      priority: 'high'
    });
  } else if (profitMargin < 10 && profitMargin > 0) {
    insights.push({
      type: 'warning',
      title: t.lowProfitMargin,
      description: t.profitMarginBelow(profitMargin.toFixed(1)),
      metric: `${profitMargin.toFixed(1)}%`,
      priority: 'high'
    });
  } else if (profitMargin <= 0) {
    insights.push({
      type: 'negative',
      title: t.operatingAtLoss,
      description: t.expensesExceedIncome,
      metric: `$${Math.abs(netProfit).toLocaleString()} loss`,
      priority: 'critical'
    });
  }

  if (largestExpenseCategory && largestExpenseCategory[1] > totalExpenses * 0.4) {
    insights.push({
      type: 'info',
      title: t.expenseConcentration,
      description: t.categoryAccountsFor(largestExpenseCategory[0], ((largestExpenseCategory[1] / totalExpenses) * 100).toFixed(0)),
      metric: `$${largestExpenseCategory[1].toLocaleString()}`,
      priority: 'medium'
    });
  }

  // Recommendations
  const recommendations = [];

  if (profitMargin < 15) {
    recommendations.push({
      action: t.reviewExpenseCategories,
      description: t.analyzeTopExpense,
      impact: 'high'
    });
  }

  recommendations.push({
    action: t.cashFlowForecast,
    description: t.projectNextMonth,
    impact: 'medium'
  });

  return {
    summary: `Income: $${totalIncome.toLocaleString()} | Expenses: $${totalExpenses.toLocaleString()} | Net: $${netProfit.toLocaleString()}`,
    metrics: {
      totalIncome,
      totalExpenses,
      netProfit,
      profitMargin,
      transactionCount: transactions.length
    },
    monthlyFlow,
    expenseCategories,
    insights,
    recommendations
  };
};

/**
 * Analyzes HR data and provides insights
 */
export const analyzeHR = (employees, payrolls = [], language = 'en') => {
  const t = getT(language);
  if (!employees || employees.length === 0) {
    return {
      summary: t.noEmployeeData,
      insights: [],
      recommendations: []
    };
  }

  const activeEmployees = employees.filter(e => e.status === 'active');
  const onLeave = employees.filter(e => e.status === 'on_leave');

  // Department distribution
  const departments = {};
  employees.forEach(e => {
    const dept = e.department || 'unassigned';
    if (!departments[dept]) departments[dept] = { count: 0, totalSalary: 0 };
    departments[dept].count++;
    departments[dept].totalSalary += e.salary || 0;
  });

  // Performance analysis
  const avgPerformance = employees.reduce((sum, e) => sum + (e.performance_score || 0), 0) / employees.length;
  const highPerformers = employees.filter(e => e.performance_score >= 4.0);
  const lowPerformers = employees.filter(e => e.performance_score < 3.0);

  // Turnover risk
  const highRisk = employees.filter(e => e.turnover_risk === 'high');
  const mediumRisk = employees.filter(e => e.turnover_risk === 'medium');

  // Salary analysis
  const totalPayroll = employees.reduce((sum, e) => sum + (e.salary || 0), 0);
  const avgSalary = totalPayroll / employees.length;

  // Generate insights
  const insights = [];

  if (highRisk.length > 0) {
    insights.push({
      type: 'warning',
      title: t.turnoverRiskAlert,
      description: t.employeesHighRisk(highRisk.length),
      metric: highRisk.length,
      employees: highRisk.map(e => e.full_name),
      priority: 'high'
    });
  }

  if (avgPerformance >= 4.0) {
    insights.push({
      type: 'positive',
      title: t.highPerformanceTeam,
      description: t.avgPerformanceAbove(avgPerformance.toFixed(1)),
      metric: avgPerformance.toFixed(1),
      priority: 'medium'
    });
  } else if (avgPerformance < 3.0) {
    insights.push({
      type: 'warning',
      title: t.performanceIssues,
      description: t.employeesBelow(lowPerformers.length),
      metric: avgPerformance.toFixed(1),
      priority: 'high'
    });
  }

  if (lowPerformers.length > 0) {
    insights.push({
      type: 'info',
      title: t.performanceReviews,
      description: t.considerReviews(lowPerformers.length),
      metric: lowPerformers.length,
      priority: 'medium'
    });
  }

  // Recommendations
  const recommendations = [];

  if (highRisk.length > 0) {
    recommendations.push({
      action: t.retainKeyTalent,
      description: t.engageHighRisk,
      impact: 'high'
    });
  }

  if (highPerformers.length > 0) {
    recommendations.push({
      action: t.performanceReviews,
      description: t.considerReviews(highPerformers.length),
      impact: 'medium'
    });
  }

  if (lowPerformers.length > 0) {
    recommendations.push({
      action: t.performanceReviews,
      description: t.considerReviews(lowPerformers.length),
      impact: 'medium'
    });
  }

  return {
    summary: `${activeEmployees.length} Active | ${onLeave.length} On Leave | Avg Performance: ${avgPerformance.toFixed(1)}`,
    metrics: {
      totalEmployees: employees.length,
      activeCount: activeEmployees.length,
      onLeaveCount: onLeave.length,
      avgPerformance,
      highRiskCount: highRisk.length,
      totalPayroll,
      avgSalary
    },
    departments,
    turnoverRisk: { high: highRisk.length, medium: mediumRisk.length },
    insights,
    recommendations
  };
};

/**
 * Analyzes projects data and provides insights
 */
export const analyzeProjects = (projects, language = 'en') => {
  const t = getT(language);
  if (!projects || projects.length === 0) {
    return {
      summary: t.noProjectData,
      insights: [],
      recommendations: []
    };
  }

  const activeProjects = projects.filter(p => p.status === 'active');
  const completedProjects = projects.filter(p => p.status === 'completed');
  const planningProjects = projects.filter(p => p.status === 'planning');
  const onHoldProjects = projects.filter(p => p.status === 'on_hold');

  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const totalSpent = projects.reduce((sum, p) => sum + (p.actual_cost || 0), 0);
  const avgProgress = projects.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / projects.length;

  // Budget analysis
  const overBudgetProjects = projects.filter(p => (p.actual_cost || 0) > (p.budget || 0));
  const atRiskProjects = projects.filter(p => {
    const budgetUsed = (p.actual_cost || 0) / (p.budget || 1);
    const progressPct = (p.progress_percentage || 0) / 100;
    return budgetUsed > progressPct + 0.2; // More than 20% over pace
  });

  // Generate insights
  const insights = [];

  if (overBudgetProjects.length > 0) {
    insights.push({
      type: 'negative',
      title: t.budgetOverrun,
      description: t.projectsOverBudget(overBudgetProjects.length),
      metric: overBudgetProjects.length,
      projects: overBudgetProjects.map(p => p.project_name),
      priority: 'high'
    });
  }

  if (atRiskProjects.length > 0) {
    insights.push({
      type: 'warning',
      title: t.atRiskProjects,
      description: t.projectsBehind(atRiskProjects.length),
      metric: atRiskProjects.length,
      priority: 'medium'
    });
  }

  if (completedProjects.length > 0) {
    const onTimeProjects = completedProjects.filter(p => {
      if (!p.end_date || !p.actual_end_date) return true;
      return new Date(p.actual_end_date) <= new Date(p.end_date);
    });
    const onTimeRate = (onTimeProjects.length / completedProjects.length) * 100;

    if (onTimeRate >= 80) {
      insights.push({
        type: 'positive',
        title: t.onTimeDelivery,
        description: t.projectsOnTrack(onTimeProjects.length),
        metric: `${onTimeRate.toFixed(0)}%`,
        priority: 'medium'
      });
    }
  }

  // Recommendations
  const recommendations = [];

  if (overBudgetProjects.length > 0) {
    recommendations.push({
      action: t.reviewProjectTimelines,
      description: t.addressDelays,
      impact: 'high'
    });
  }

  if (activeProjects.length > 3) {
    recommendations.push({
      action: t.resourceAllocation,
      description: t.redistributeResources,
      impact: 'medium'
    });
  }

  return {
    summary: `${activeProjects.length} Active | ${completedProjects.length} Completed | Budget: $${totalBudget.toLocaleString()}`,
    metrics: {
      totalProjects: projects.length,
      activeCount: activeProjects.length,
      completedCount: completedProjects.length,
      planningCount: planningProjects.length,
      onHoldCount: onHoldProjects.length,
      totalBudget,
      totalSpent,
      avgProgress
    },
    overBudgetProjects,
    atRiskProjects,
    insights,
    recommendations
  };
};

/**
 * Generates overall business health score and insights
 */
export const analyzeBusinessHealth = (data) => {
  const { salesOrders, inventory, transactions, employees, projects, language = 'en' } = data;

  let healthScore = 70; // Base score
  const factors = [];
  const criticalIssues = [];

  // Sales health
  if (salesOrders && salesOrders.length > 0) {
    const salesAnalysis = analyzeSales(salesOrders, [], language);
    if (salesAnalysis.metrics.growthRate > 5) {
      healthScore += 10;
      factors.push({ name: 'Sales Growth', impact: '+10', status: 'positive' });
    } else if (salesAnalysis.metrics.growthRate < -5) {
      healthScore -= 10;
      factors.push({ name: 'Sales Decline', impact: '-10', status: 'negative' });
      criticalIssues.push('Revenue declining - review sales strategy');
    }
  }

  // Inventory health
  if (inventory && inventory.length > 0) {
    const invAnalysis = analyzeInventory(inventory, [], language);
    if (invAnalysis.metrics.lowStockCount > 3) {
      healthScore -= 5;
      factors.push({ name: 'Low Stock Issues', impact: '-5', status: 'warning' });
      criticalIssues.push(`${invAnalysis.metrics.lowStockCount} items need restocking`);
    }
    if (invAnalysis.metrics.deadStockCount > 0) {
      healthScore -= 5;
      factors.push({ name: 'Dead Stock', impact: '-5', status: 'warning' });
    }
  }

  // Financial health
  if (transactions && transactions.length > 0) {
    const finAnalysis = analyzeFinancials(transactions, [], [], language);
    if (finAnalysis.metrics.profitMargin > 15) {
      healthScore += 10;
      factors.push({ name: 'Healthy Margins', impact: '+10', status: 'positive' });
    } else if (finAnalysis.metrics.profitMargin < 0) {
      healthScore -= 15;
      factors.push({ name: 'Operating Loss', impact: '-15', status: 'negative' });
      criticalIssues.push('Business is operating at a loss');
    }
  }

  // HR health
  if (employees && employees.length > 0) {
    const hrAnalysis = analyzeHR(employees, [], language);
    if (hrAnalysis.metrics.highRiskCount > 0) {
      healthScore -= 5;
      factors.push({ name: 'Turnover Risk', impact: '-5', status: 'warning' });
      criticalIssues.push(`${hrAnalysis.metrics.highRiskCount} employees at risk of leaving`);
    }
    if (hrAnalysis.metrics.avgPerformance >= 4) {
      healthScore += 5;
      factors.push({ name: 'Team Performance', impact: '+5', status: 'positive' });
    }
  }

  // Project health
  if (projects && projects.length > 0) {
    const projAnalysis = analyzeProjects(projects, language);
    if (projAnalysis.overBudgetProjects.length > 0) {
      healthScore -= 5;
      factors.push({ name: 'Project Overruns', impact: '-5', status: 'warning' });
    }
  }

  // Normalize score
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    score: healthScore,
    status: healthScore >= 80 ? 'excellent' : healthScore >= 60 ? 'good' : healthScore >= 40 ? 'fair' : 'needs_attention',
    factors,
    criticalIssues,
    summary: healthScore >= 80
      ? 'Your business is performing well across all areas'
      : healthScore >= 60
        ? 'Business is healthy but there are areas for improvement'
        : 'Several areas need immediate attention'
  };
};

/**
 * Analyzes CRM data and provides insights
 */
export const analyzeCRM = (customers, leads = [], opportunities = []) => {
  if (!customers || customers.length === 0) {
    return {
      summary: "No CRM data available.",
      insights: [],
      recommendations: []
    };
  }

  const activeCustomers = customers.filter(c => c.status === 'active');
  const prospects = customers.filter(c => c.status === 'prospect');
  const churned = customers.filter(c => c.status === 'churned');

  const totalMRR = customers.reduce((sum, c) => sum + (c.monthly_value || 0), 0);
  const avgCustomerValue = totalMRR / customers.length;

  const industries = {};
  customers.forEach(c => {
    const ind = c.industry || 'other';
    industries[ind] = (industries[ind] || 0) + 1;
  });

  const topIndustry = Object.entries(industries).sort((a, b) => b[1] - a[1])[0];
  const qualifiedLeads = leads.filter(l => l.status === 'qualified');

  const pipelineValue = opportunities.reduce((sum, o) =>
    sum + ((o.expected_value || 0) * (o.probability || 0) / 100), 0
  );

  const closingThisMonth = opportunities.filter(o => {
    if (!o.expected_close_date) return false;
    const closeDate = new Date(o.expected_close_date);
    const now = new Date();
    return closeDate.getMonth() === now.getMonth() && closeDate.getFullYear() === now.getFullYear();
  });

  const insights = [];

  if (churned.length > 0) {
    const churnRate = (churned.length / customers.length) * 100;
    insights.push({
      type: churnRate > 10 ? 'negative' : 'warning',
      title: 'Customer Churn',
      description: `${churned.length} customers have churned (${churnRate.toFixed(1)}% rate)`,
      metric: `${churnRate.toFixed(1)}%`,
      priority: churnRate > 10 ? 'high' : 'medium'
    });
  }

  if (qualifiedLeads.length > 0) {
    insights.push({
      type: 'positive',
      title: 'Qualified Leads',
      description: `${qualifiedLeads.length} leads ready for sales outreach`,
      metric: qualifiedLeads.length,
      priority: 'high'
    });
  }

  if (pipelineValue > 0) {
    insights.push({
      type: 'info',
      title: 'Pipeline Value',
      description: 'Weighted pipeline based on probability',
      metric: `$${pipelineValue.toLocaleString()}`,
      priority: 'medium'
    });
  }

  if (closingThisMonth.length > 0) {
    insights.push({
      type: 'info',
      title: 'Closing This Month',
      description: `${closingThisMonth.length} opportunities expected`,
      metric: `$${closingThisMonth.reduce((sum, o) => sum + (o.expected_value || 0), 0).toLocaleString()}`,
      priority: 'high'
    });
  }

  const recommendations = [];

  if (qualifiedLeads.length > 0) {
    recommendations.push({
      action: 'Convert Qualified Leads',
      description: `Prioritize outreach to ${qualifiedLeads.length} qualified leads`,
      impact: 'high'
    });
  }

  if (churned.length > 0) {
    recommendations.push({
      action: 'Win Back Churned',
      description: 'Consider re-engagement campaigns',
      impact: 'medium'
    });
  }

  if (activeCustomers.length > 0) {
    recommendations.push({
      action: 'Upsell Opportunities',
      description: 'Identify upsell with top customers',
      impact: 'high'
    });
  }

  return {
    summary: `${activeCustomers.length} Active | ${prospects.length} Prospects | MRR: $${totalMRR.toLocaleString()}`,
    metrics: {
      totalCustomers: customers.length,
      activeCount: activeCustomers.length,
      prospectCount: prospects.length,
      churnedCount: churned.length,
      totalMRR,
      avgCustomerValue,
      pipelineValue,
      qualifiedLeadsCount: qualifiedLeads.length
    },
    industries,
    insights,
    recommendations
  };
};

/**
 * Analyzes manufacturing data and provides insights
 */
export const analyzeManufacturing = (workOrders = [], boms = [], language = 'en') => {
  const t = getT(language);
  if (!workOrders || workOrders.length === 0) {
    return {
      summary: t.noManufacturingData,
      insights: [],
      recommendations: [],
      metrics: {}
    };
  }

  const activeOrders = workOrders.filter(w => w.status === 'in_progress');
  const completedOrders = workOrders.filter(w => w.status === 'completed');
  const delayedOrders = workOrders.filter(w => {
    if (!w.due_date) return false;
    return new Date(w.due_date) < new Date() && w.status !== 'completed';
  });

  const totalQuantity = workOrders.reduce((sum, w) => sum + (w.quantity || 0), 0);
  const completedQuantity = completedOrders.reduce((sum, w) => sum + (w.quantity || 0), 0);
  const efficiencyRate = totalQuantity > 0 ? (completedQuantity / totalQuantity) * 100 : 0;

  const insights = [];

  if (delayedOrders.length > 0) {
    insights.push({
      type: 'warning',
      title: t.delayedOrders,
      description: t.ordersPastDue(delayedOrders.length),
      metric: delayedOrders.length,
      priority: 'high'
    });
  }

  if (efficiencyRate >= 80) {
    insights.push({
      type: 'positive',
      title: t.highProductionEfficiency,
      description: t.productionEfficiencyAt(efficiencyRate.toFixed(1)),
      metric: `${efficiencyRate.toFixed(1)}%`,
      priority: 'medium'
    });
  }

  if (activeOrders.length > 5) {
    insights.push({
      type: 'info',
      title: t.highWorkLoad,
      description: t.ordersInProgress(activeOrders.length),
      metric: activeOrders.length,
      priority: 'medium'
    });
  }

  const recommendations = [];

  if (delayedOrders.length > 0) {
    recommendations.push({
      action: t.prioritizeDelayed,
      description: t.allocateResources,
      impact: 'high'
    });
  }

  if (activeOrders.length > 5) {
    recommendations.push({
      action: t.optimizeScheduling,
      description: t.reviewProduction,
      impact: 'medium'
    });
  }

  recommendations.push({
    action: t.predictiveMaintenance,
    description: t.scheduleMaintenance,
    impact: 'medium'
  });

  return {
    summary: `${activeOrders.length} Active | ${completedOrders.length} Completed | ${efficiencyRate.toFixed(0)}% Efficiency`,
    metrics: {
      totalOrders: workOrders.length,
      activeCount: activeOrders.length,
      completedCount: completedOrders.length,
      delayedCount: delayedOrders.length,
      efficiencyRate,
      totalQuantity
    },
    insights,
    recommendations
  };
};

/**
 * Analyzes procurement data and provides insights
 */
export const analyzeProcurement = (purchaseOrders = [], vendors = [], language = 'en') => {
  const t = getT(language);
  if (!purchaseOrders || purchaseOrders.length === 0) {
    return {
      summary: t.noProcurementData,
      insights: [],
      recommendations: [],
      metrics: {}
    };
  }

  const pendingOrders = purchaseOrders.filter(p => p.status === 'pending' || p.status === 'ordered');
  const receivedOrders = purchaseOrders.filter(p => p.status === 'received');
  const totalSpend = purchaseOrders.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const avgOrderValue = totalSpend / purchaseOrders.length;

  const vendorSpend = {};
  purchaseOrders.forEach(p => {
    if (p.vendor_name) {
      vendorSpend[p.vendor_name] = (vendorSpend[p.vendor_name] || 0) + (p.total_amount || 0);
    }
  });

  const topVendors = Object.entries(vendorSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, spend]) => ({ name, spend }));

  const insights = [];

  if (pendingOrders.length > 5) {
    insights.push({
      type: 'warning',
      title: t.pendingOrders,
      description: t.ordersAwaiting(pendingOrders.length),
      metric: pendingOrders.length,
      priority: 'medium'
    });
  }

  if (topVendors.length > 0 && topVendors[0].spend > totalSpend * 0.5) {
    insights.push({
      type: 'info',
      title: t.vendorConcentration,
      description: t.vendorRepresents(topVendors[0].name, ((topVendors[0].spend / totalSpend) * 100).toFixed(0)),
      metric: `$${topVendors[0].spend.toLocaleString()}`,
      priority: 'medium'
    });
  }

  const recommendations = [];

  if (Object.keys(vendorSpend).length < 3) {
    recommendations.push({
      action: t.diversifySuppliers,
      description: t.addBackupVendors,
      impact: 'medium'
    });
  }

  recommendations.push({
    action: t.negotiateBulkPricing,
    description: t.leverageVolume,
    impact: 'high'
  });

  return {
    summary: `${pendingOrders.length} Pending | $${totalSpend.toLocaleString()} Total Spend`,
    metrics: {
      totalOrders: purchaseOrders.length,
      pendingCount: pendingOrders.length,
      receivedCount: receivedOrders.length,
      totalSpend,
      avgOrderValue,
      vendorCount: Object.keys(vendorSpend).length
    },
    topVendors,
    insights,
    recommendations
  };
};

/**
 * Analyzes fixed assets data and provides insights
 */
export const analyzeAssets = (assets = [], language = 'en') => {
  const t = getT(language);
  if (!assets || assets.length === 0) {
    return {
      summary: t.noAssetData,
      insights: [],
      recommendations: [],
      metrics: {}
    };
  }

  const activeAssets = assets.filter(a => a.status === 'active' || a.status === 'in_use');
  const totalValue = assets.reduce((sum, a) => sum + (a.purchase_cost || 0), 0);
  const totalDepreciation = assets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
  const netBookValue = totalValue - totalDepreciation;

  const maintenanceDue = assets.filter(a => {
    if (!a.next_maintenance_date) return false;
    return new Date(a.next_maintenance_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  });

  const fullyDepreciated = assets.filter(a =>
    (a.accumulated_depreciation || 0) >= (a.purchase_cost || 0)
  );

  const insights = [];

  if (maintenanceDue.length > 0) {
    insights.push({
      type: 'warning',
      title: t.maintenanceDue,
      description: t.assetsRequireMaintenance(maintenanceDue.length),
      metric: maintenanceDue.length,
      priority: 'high'
    });
  }

  if (fullyDepreciated.length > 0) {
    insights.push({
      type: 'info',
      title: t.fullyDepreciated,
      description: t.assetsFullyDepreciated(fullyDepreciated.length),
      metric: fullyDepreciated.length,
      priority: 'low'
    });
  }

  insights.push({
    type: 'info',
    title: t.netBookValue,
    description: t.currentValueAfter,
    metric: `$${netBookValue.toLocaleString()}`,
    priority: 'medium'
  });

  const recommendations = [];

  if (maintenanceDue.length > 0) {
    recommendations.push({
      action: t.scheduleMaintenance2,
      description: t.planMaintenance(maintenanceDue.length),
      impact: 'high'
    });
  }

  if (fullyDepreciated.length > assets.length * 0.3) {
    recommendations.push({
      action: t.assetReplacementPlan,
      description: t.considerReplacement,
      impact: 'medium'
    });
  }

  return {
    summary: `${activeAssets.length} Active | $${netBookValue.toLocaleString()} NBV`,
    metrics: {
      totalAssets: assets.length,
      activeCount: activeAssets.length,
      totalValue,
      totalDepreciation,
      netBookValue,
      maintenanceDueCount: maintenanceDue.length,
      fullyDepreciatedCount: fullyDepreciated.length
    },
    insights,
    recommendations
  };
};

/**
 * Analyzes expense data and provides insights
 */
export const analyzeExpenses = (expenses = [], language = 'en') => {
  const t = getT(language);
  if (!expenses || expenses.length === 0) {
    return {
      summary: t.noExpenseData,
      insights: [],
      recommendations: [],
      metrics: {}
    };
  }

  const pendingExpenses = expenses.filter(e => e.status === 'pending' || e.status === 'submitted');
  const approvedExpenses = expenses.filter(e => e.status === 'approved');
  const rejectedExpenses = expenses.filter(e => e.status === 'rejected');

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingAmount = pendingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const categorySpend = {};
  expenses.forEach(e => {
    const cat = e.category || 'other';
    categorySpend[cat] = (categorySpend[cat] || 0) + (e.amount || 0);
  });

  const topCategories = Object.entries(categorySpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));

  const insights = [];

  if (pendingExpenses.length > 5) {
    insights.push({
      type: 'warning',
      title: t.pendingApprovals,
      description: t.expensesAwaiting(pendingExpenses.length, pendingAmount.toLocaleString()),
      metric: `$${pendingAmount.toLocaleString()}`,
      priority: 'high'
    });
  }

  if (topCategories.length > 0) {
    insights.push({
      type: 'info',
      title: t.topExpenseCategory,
      description: t.largestExpense(topCategories[0].name, language),
      metric: `$${topCategories[0].amount.toLocaleString()}`,
      priority: 'medium'
    });
  }

  const rejectionRate = expenses.length > 0 ? (rejectedExpenses.length / expenses.length) * 100 : 0;
  if (rejectionRate > 10) {
    insights.push({
      type: 'warning',
      title: t.highRejectionRate,
      description: t.expensesRejected(rejectionRate.toFixed(0)),
      metric: `${rejectionRate.toFixed(0)}%`,
      priority: 'medium'
    });
  }

  const recommendations = [];

  if (pendingExpenses.length > 5) {
    recommendations.push({
      action: t.reviewPendingExpenses,
      description: t.clearBacklog,
      impact: 'high'
    });
  }

  recommendations.push({
    action: t.setCategoryBudgets,
    description: t.establishLimits,
    impact: 'medium'
  });

  return {
    summary: `${pendingExpenses.length} Pending | $${totalAmount.toLocaleString()} Total`,
    metrics: {
      totalExpenses: expenses.length,
      pendingCount: pendingExpenses.length,
      approvedCount: approvedExpenses.length,
      rejectedCount: rejectedExpenses.length,
      totalAmount,
      pendingAmount,
      rejectionRate
    },
    topCategories,
    insights,
    recommendations
  };
};

/**
 * Analyzes payroll data and provides insights
 */
export const analyzePayroll = (payrollRecords = [], employees = [], language = 'en') => {
  const t = getT(language);
  if (!payrollRecords || payrollRecords.length === 0) {
    return {
      summary: t.noPayrollData,
      insights: [],
      recommendations: [],
      metrics: {}
    };
  }

  const pendingPayroll = payrollRecords.filter(p => p.status === 'pending' || p.status === 'processing');
  const completedPayroll = payrollRecords.filter(p => p.status === 'paid' || p.status === 'completed');

  const totalGross = payrollRecords.reduce((sum, p) => sum + (p.gross_salary || p.amount || 0), 0);
  const totalDeductions = payrollRecords.reduce((sum, p) => sum + (p.deductions || 0), 0);
  const totalNet = payrollRecords.reduce((sum, p) => sum + (p.net_salary || p.net_amount || 0), 0);

  const avgSalary = payrollRecords.length > 0 ? totalGross / payrollRecords.length : 0;

  const insights = [];

  if (pendingPayroll.length > 0) {
    insights.push({
      type: 'warning',
      title: t.pendingPayroll,
      description: t.payrollPending(pendingPayroll.length),
      metric: pendingPayroll.length,
      priority: 'high'
    });
  }

  insights.push({
    type: 'info',
    title: t.totalPayrollCost,
    description: t.grossPayroll,
    metric: `$${totalGross.toLocaleString()}`,
    priority: 'medium'
  });

  const deductionRate = totalGross > 0 ? (totalDeductions / totalGross) * 100 : 0;
  if (deductionRate > 30) {
    insights.push({
      type: 'info',
      title: t.deductionRate,
      description: t.ofGrossSalary(deductionRate.toFixed(1)),
      metric: `${deductionRate.toFixed(1)}%`,
      priority: 'low'
    });
  }

  const recommendations = [];

  if (pendingPayroll.length > 0) {
    recommendations.push({
      action: t.processPendingPayroll,
      description: t.completeProcessing,
      impact: 'high'
    });
  }

  recommendations.push({
    action: t.reviewTaxCompliance,
    description: t.ensureWithholdings,
    impact: 'medium'
  });

  return {
    summary: `${completedPayroll.length} Processed | $${totalNet.toLocaleString()} Net`,
    metrics: {
      totalRecords: payrollRecords.length,
      pendingCount: pendingPayroll.length,
      completedCount: completedPayroll.length,
      totalGross,
      totalDeductions,
      totalNet,
      avgSalary,
      deductionRate
    },
    insights,
    recommendations
  };
};

/**
 * Analyzes contract data and provides insights
 */
export const analyzeContracts = (contracts = [], language = 'en') => {
  const t = getT(language);
  if (!contracts || contracts.length === 0) {
    return {
      summary: t.noContractData,
      insights: [],
      recommendations: [],
      metrics: {}
    };
  }

  const activeContracts = contracts.filter(c => c.status === 'active');
  const expiringContracts = contracts.filter(c => {
    if (!c.end_date) return false;
    const endDate = new Date(c.end_date);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return endDate <= thirtyDaysFromNow && c.status === 'active';
  });

  const totalValue = contracts.reduce((sum, c) => sum + (c.value || c.contract_value || 0), 0);
  const activeValue = activeContracts.reduce((sum, c) => sum + (c.value || c.contract_value || 0), 0);

  const insights = [];

  if (expiringContracts.length > 0) {
    insights.push({
      type: 'warning',
      title: t.contractsExpiringSoon,
      description: t.contractsExpire(expiringContracts.length),
      metric: expiringContracts.length,
      priority: 'high'
    });
  }

  insights.push({
    type: 'info',
    title: t.activeContractValue,
    description: t.totalValueActive,
    metric: `$${activeValue.toLocaleString()}`,
    priority: 'medium'
  });

  if (activeContracts.length > 0) {
    insights.push({
      type: 'positive',
      title: t.activeContracts,
      description: t.contractsActive(activeContracts.length),
      metric: activeContracts.length,
      priority: 'medium'
    });
  }

  const recommendations = [];

  if (expiringContracts.length > 0) {
    recommendations.push({
      action: t.initiateRenewals,
      description: t.startRenewalProcess(expiringContracts.length),
      impact: 'high'
    });
  }

  recommendations.push({
    action: t.contractReview,
    description: t.regularlyReview,
    impact: 'medium'
  });

  return {
    summary: t.contractsSummary(activeContracts.length, activeValue.toLocaleString()),
    metrics: {
      totalContracts: contracts.length,
      activeCount: activeContracts.length,
      expiringCount: expiringContracts.length,
      totalValue,
      activeValue
    },
    expiringContracts: expiringContracts.slice(0, 5),
    insights,
    recommendations
  };
};

export default {
  analyzeSales,
  analyzeInventory,
  analyzeFinancials,
  analyzeHR,
  analyzeProjects,
  analyzeCRM,
  analyzeBusinessHealth,
  analyzeManufacturing,
  analyzeProcurement,
  analyzeAssets,
  analyzeExpenses,
  analyzePayroll,
  analyzeContracts
};
