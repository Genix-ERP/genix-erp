// Uzbekistan administrative-territorial division — used by the project
// create/edit form to populate Viloyat → Shahar dropdowns.
//
// Structure: 12 viloyats + 1 republic (Qoraqalpog'iston) + 1 city of
// republican subordination (Toshkent shahri). Each entry lists its main
// cities and districts (tumans). Names are Uzbek-Latin (the project
// defaults to that locale) so the Construction overview, reports, and
// search match what the user typed in the dropdown.
//
// This is a curated list — not every village, just the cities and
// district seats that show up in real projects. Easy to extend if a
// project requires a missing locality.

export const UZ_REGIONS = [
  {
    key: 'tashkent_city',
    name: "Toshkent shahri",
    cities: [
      'Bektemir', 'Chilonzor', "Mirobod", 'Mirzo Ulug\'bek', 'Olmazor',
      'Sirg\'ali', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yashnobod',
      "Yunusobod", 'Yangihayot',
    ],
  },
  {
    key: 'tashkent',
    name: 'Toshkent viloyati',
    cities: [
      'Nurafshon', 'Olmaliq', 'Angren', 'Bekobod', 'Chirchiq', 'Yangiyo\'l',
      'Ohangaron', 'Bo\'stonliq', 'Qibray', 'Ohangaron tumani', 'Parkent',
      'Piskent', 'Quyi Chirchiq', 'O\'rta Chirchiq', 'Yuqori Chirchiq',
      'Zangiota', "Yangiyo'l tumani", 'Oqqo\'rg\'on', 'Bekobod tumani',
    ],
  },
  {
    key: 'andijon',
    name: 'Andijon viloyati',
    cities: [
      'Andijon', 'Asaka', 'Xonobod', 'Shahrixon',
      'Andijon tumani', 'Baliqchi', 'Bo\'z', 'Buloqboshi',
      'Izboskan', 'Jalaquduq', 'Marhamat', 'Oltinko\'l',
      'Paxtaobod', 'Qo\'rg\'ontepa', 'Ulug\'nor', 'Xo\'jaobod',
    ],
  },
  {
    key: 'bukhara',
    name: 'Buxoro viloyati',
    cities: [
      'Buxoro', 'Kogon', 'G\'ijduvon', 'Vobkent',
      'Olot', 'Buxoro tumani', 'G\'ijduvon tumani', 'Jondor',
      'Kogon tumani', 'Qorako\'l', 'Qorovulbozor', 'Peshku',
      'Romitan', 'Shofirkon', 'Vobkent tumani',
    ],
  },
  {
    key: 'fergana',
    name: 'Farg\'ona viloyati',
    cities: [
      'Farg\'ona', 'Marg\'ilon', 'Qo\'qon', 'Quvasoy', 'Quva',
      'Bag\'dod', 'Beshariq', 'Buvayda', 'Dang\'ara', 'Furqat',
      'Oltiariq', 'Qo\'shtepa', 'Rishton', 'So\'x', 'Toshloq',
      'Uchko\'prik', 'Yozyovon', 'Farg\'ona tumani',
    ],
  },
  {
    key: 'jizzakh',
    name: 'Jizzax viloyati',
    cities: [
      'Jizzax', 'G\'allaorol', 'Paxtakor', 'Do\'stlik',
      'Arnasoy', 'Baxmal', 'Forish', 'Mirzacho\'l',
      'Sharof Rashidov', 'Yangiobod', 'Zafarobod', 'Zarbdor', 'Zomin',
    ],
  },
  {
    key: 'khorezm',
    name: 'Xorazm viloyati',
    cities: [
      'Urganch', 'Xiva', 'Bog\'ot', 'Gurlan', 'Hazorasp',
      'Qo\'shko\'pir', 'Shovot', 'Urganch tumani', 'Xiva tumani',
      'Xonqa', 'Yangiariq', 'Yangibozor', 'Tuproqqal\'a',
    ],
  },
  {
    key: 'namangan',
    name: 'Namangan viloyati',
    cities: [
      'Namangan', 'Chust', 'Pop', 'To\'raqo\'rg\'on', 'Kosonsoy',
      'Mingbuloq', 'Namangan tumani', 'Norin', 'Uychi', 'Uchqo\'rg\'on',
      'Yangiqo\'rg\'on', 'Chortoq',
    ],
  },
  {
    key: 'navoi',
    name: 'Navoiy viloyati',
    cities: [
      'Navoiy', 'Zarafshon', 'Konimex', 'Karmana', 'Nurota',
      'Qiziltepa', 'Tomdi', 'Uchquduq', 'Xatirchi', 'Navbahor',
    ],
  },
  {
    key: 'kashkadarya',
    name: 'Qashqadaryo viloyati',
    cities: [
      'Qarshi', 'Shahrisabz', 'Kitob', 'G\'uzor', 'Muborak',
      'Chiroqchi', 'Dehqonobod', 'Kasbi', 'Koson', 'Mirishkor',
      'Nishon', 'Qamashi', 'Yakkabog\'',
    ],
  },
  {
    key: 'samarkand',
    name: 'Samarqand viloyati',
    cities: [
      'Samarqand', 'Kattaqo\'rg\'on', 'Bulung\'ur', 'Ishtixon', 'Jomboy',
      'Narpay', 'Nurobod', 'Oqdaryo', 'Paxtachi', 'Payariq',
      'Pastdarg\'om', 'Qo\'shrabot', 'Samarqand tumani', 'Toyloq', 'Urgut',
    ],
  },
  {
    key: 'syrdarya',
    name: 'Sirdaryo viloyati',
    cities: [
      'Guliston', 'Yangiyer', 'Boyovut', 'Mirzaobod', 'Oqoltin',
      'Sayxunobod', 'Sardoba', 'Sirdaryo tumani', 'Xovos',
    ],
  },
  {
    key: 'surkhandarya',
    name: 'Surxondaryo viloyati',
    cities: [
      'Termiz', 'Boysun', 'Denov', 'Jarqo\'rg\'on', 'Sho\'rchi',
      'Angor', 'Bandixon', 'Muzrabot', 'Oltinsoy', 'Qiziriq',
      'Qumqo\'rg\'on', 'Sariosiyo', 'Sherobod', 'Termiz tumani', 'Uzun',
    ],
  },
  {
    key: 'karakalpakstan',
    name: 'Qoraqalpog\'iston Respublikasi',
    cities: [
      'Nukus', 'Beruniy', 'Chimboy', 'Mo\'ynoq', 'Qo\'ng\'irot',
      'Qorao\'zak', 'Kegeyli', 'Ellikqal\'a', 'Nukus tumani',
      'Taxtako\'pir', 'To\'rtko\'l', 'Xo\'jayli', 'Bozatov', 'Shumanay', 'Amudaryo',
    ],
  },
];

// Helper: given a region name, return its sorted list of cities/tumans.
export function citiesForRegion(regionName) {
  if (!regionName) return [];
  const r = UZ_REGIONS.find((x) => x.name === regionName);
  return r ? [...r.cities].sort((a, b) => a.localeCompare(b, 'uz')) : [];
}
