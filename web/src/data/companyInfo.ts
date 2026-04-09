/**
 * Long-form company copy sourced from web/source/companyInfo.txt.
 * Arabic (ar) locale uses English body in the UI until professional AR copy exists.
 */
export type CompanyLocaleBody = {
  zh: string;
  en: string;
  fr: string;
};

export const COMPANY_SECTIONS: {
  id: "profile" | "development" | "culture" | "network";
  titleKey: string;
  body: CompanyLocaleBody;
}[] = [
  {
    id: "profile",
    titleKey: "company.profileTitle",
    body: {
      zh: "CREALINK 是全球领先的重型卡车及零部件供应链服务商，总部位于中国济南。公司旗下整合了中国重卡进出口有限公司、山东菲信国际贸易及联创国际（尼日尔/马里）等优势资源，深度深耕中东、非洲、中亚及东南亚市场。\n\n我们拥有中国重汽 (Sinotruk)、陕汽 (Shacman) 及多款国际主流重卡品牌的战略资源，提供从整车出口到全系列原厂零部件的一站式供应保障。依托在海外设立的多家直属分公司及仓储中心，我们构建了高效的全球物流响应体系，2024 年年度产值已突破 2 亿元人民币。\n\n秉持「诚信为本，服务无限」的核心理念，CREALINK 致力于通过数字化工具优化 B2B 贸易流程。无论是矿山车队还是大型基建项目，我们始终以可靠的品质与“亲人般”的服务，助力全球客户行稳致远，共同链接价值。",
      en: "CREALINK is a global leader in heavy-duty truck and parts supply chain services, headquartered in Jinan, China. The company integrates advantageous resources including China Heavy Truck Import & Export, Shandong Feixin International Trade, and Lianchuang International (Niger/Mali), with deep engagement across the Middle East, Africa, Central Asia, and Southeast Asia.\n\nWe hold strategic access to Sinotruk, Shacman, and other leading international heavy-duty brands, delivering one-stop supply from complete vehicle export to full ranges of genuine spare parts. With multiple overseas branch offices and warehousing hubs, we have built an efficient global logistics response capability; in 2024, annual output value exceeded 200 million RMB.\n\nGuided by the core philosophy of \"Integrity First, Unlimited Service,\" CREALINK is committed to streamlining B2B trade through digital tools. Whether for mining fleets or large infrastructure projects, we provide dependable quality and caring, family-style service—helping customers worldwide move forward with confidence and linking value together.",
      fr: "CREALINK est un acteur mondial de premier plan des services de chaîne d'approvisionnement pour poids lourds et pièces détachées, dont le siège est à Jinan, en Chine. Le groupe intègre notamment China Heavy Truck Import & Export, Shandong Feixin International Trade et Lianchuang International (Niger/Mali), avec une présence approfondie au Moyen-Orient, en Afrique, en Asie centrale et en Asie du Sud-Est.\n\nNous disposons de ressources stratégiques auprès de Sinotruk, Shacman et d'autres grandes marques internationales de poids lourds, et assurons une offre intégrée de l'export de véhicules complets à l'ensemble des pièces d'origine. Grâce à plusieurs filiales et centres logistiques à l'étranger, nous avons mis en place une capacité de réponse logistique mondiale efficace ; en 2024, le chiffre d'affaires annuel a dépassé 200 millions de RMB.\n\nPortée par la philosophie « Intégrité d'abord, service sans limite », CREALINK s'engage à optimiser les échanges B2B grâce aux outils numériques. Qu'il s'agisse de flottes minières ou de grands projets d'infrastructure, nous offrons une qualité fiable et un service aux petits soins—pour accompagner nos clients dans la durée et relier les valeurs ensemble.",
    },
  },
  {
    id: "development",
    titleKey: "company.developmentTitle",
    body: {
      zh: "公司旗下拥有中國重卡進出口有限公司、山东菲信国际贸易有限公司以及联创国际(尼日尔/马里)公司，并以「CREALINK」作为核心品牌。\n\n中國重卡進出口有限公司专注于中东市场，不断提升海外整车及零部件的销售与服务效率。山东菲信国际贸易有限公司拥有多个重型卡车知名品牌的代理权，为中国重汽进出口有限公司及其海外子公司集中采购零部件。联创国际依托集团的整体战略，在当地拓展业务。\n\n公司经销的整车及零部件品牌涵盖中国重汽(Sinotruk)、上汽红岩(SAICHongyan)、欧曼(Auman)、奔驰(Mercedes-Benz)、沃尔沃(Volvo)、斯堪尼亚(Scania)等。\n\n在2020年至2024年间，公司年度总销售额创下了2亿元人民币的记录，位居行业领先地位。公司秉持「诚信为本，服务无限」的原则，致力于持续提升客户满意度，并打造以重型卡车为核心的企业文化。公司先后荣获「最佳诚实守信企业」「中国最具人气参展企业」等荣誉称号。",
      en: "The company comprises China Heavy Truck Import & Export, Shandong Feixin International Trade, and Lianchuang International (Niger/Mali), with CREALINK serving as its flagship brand.\n\nChina Heavy Truck Import & Export focuses on the Middle Eastern market, enhancing the efficiency of overseas sales and services for complete vehicles and spare parts. Shandong Feixin holds agency rights for major heavy-duty truck brands, centralizing procurement for China Heavy Truck Import & Export and its international subsidiaries. Lianchuang International develops its local operations by leveraging the Group's global strategy.\n\nThe company markets complete vehicles and spare parts from brands such as Sinotruk, SAIC Hongyan, Auman, Mercedes-Benz, Volvo, Scania, and others.\n\nWith a record-breaking cumulative annual turnover reaching 200 million RMB between 2020 and 2024, the company ranks among the leaders in its sector. Guided by the principles of \"Integrity First, Unlimited Service,\" the company aims to continuously enhance customer satisfaction and cultivate a corporate culture centered on the heavy-duty truck industry. The company has successively received numerous honorary titles, such as \"Most Honest and Credible Enterprise\" and \"Most Popular Enterprise at Exhibitions in China.\"",
      fr: "L'entreprise regroupe China Heavy Truck Import & Export, Shandong Feixin International Trade et Lianchuang International (Niger/Mali), avec CREALINK comme marque phare.\n\nChina Heavy Truck Import & Export se concentre sur le marché du Moyen-Orient, renforçant l'efficacité des ventes et services de véhicules complets et pièces détachées à l'étranger. Shandong Feixin détient des droits d'agence pour de grandes marques de poids lourds, centralisant les achats pour China Heavy Truck Import & Export et ses filiales internationales. Lianchuang International développe ses activités locales en s'appuyant sur la stratégie globale du groupe.\n\nL'entreprise commercialise des véhicules complets et pièces détachées de marques telles que Sinotruk, SAIC Hongyan, Auman, Mercedes-Benz, Volvo, Scania, etc.\n\nAvec un chiffre d'affaires annuel record atteignant 200 millions de yuans RMB cumulés entre 2020 et 2024, elle se positionne parmi les leaders de son secteur. Guidée par les principes de « l'Intégrité en priorité, le Service illimité », l'entreprise vise à améliorer continuellement la satisfaction des clients et à bâtir une culture d'entreprise axée sur les poids lourds. L'entreprise a reçu successivement de nombreux titres honorifiques tels que « Entreprise la plus honnête et la plus crédible » et « Entreprise la plus populaire aux expositions en Chine ».",
    },
  },
  {
    id: "culture",
    titleKey: "company.cultureTitle",
    body: {
      zh: "公司全面引入了先进的现代化企业管理模式和管理手段。秉持「客户至上」的企业理念，以持续改进和不断完善管理为手段，以提高客户满意度为企业的最终目标，塑造了具有「红岩」特色的企业文化。通过优质服务精心打造「重卡」品牌，坚定地走品牌与服务之路。\n\n公司始终坚持「诚信为本，服务无限」的原则。凭借公司自身的信誉、产品质量、标准化的价格以及齐全的零部件种类，再加上周到贴心的服务，不断开拓新客户，扩大市场份额。\n\n同时，公司在中国重汽上汽菲亚特红岩动力总成有限公司的市场宏观战略指导下，发挥市场主渠道作用，把握商机。\n\n此外，公司坚守「至诚无息，博厚悠远」的企业文化理念，内外发展并重。在核心理念的指引下，形成了「严格、踏实、上进、创新」的价值观体系。",
      en: "The company has fully adopted advanced, modern models and methods of corporate management. Adhering to the corporate philosophy that \"The Customer is King\"—utilizing continuous and constant management improvement as its primary means, and aiming to enhance customer satisfaction as its ultimate corporate objective—it has forged a corporate culture bearing distinct \"Hongyan\" characteristics. Through its dedication to service, it has meticulously cultivated its \"heavy-duty truck\" brand, firmly committing itself to a strategic path centered on branding and service excellence.\n\nThe company consistently upholds the principle of \"Integrity First, Unlimited Service.\" Leveraging its own corporate reputation, product quality, standardized pricing, and a comprehensive range of spare parts—combined with attentive and warm customer service—it constantly strives to win over new clients and expand its market share.\n\nConcurrently, under the guidance of the macro-marketing strategy of Sinotruk SAIC Fiat Hongyan Powertrain Co., Ltd., the company plays a leading role within market channels and actively seizes business opportunities.\n\nFurthermore, the company adheres to a corporate culture philosophy characterized by \"Infinite Sincerity; Profound and Enduring Generosity.\" It places equal emphasis on both internal and external development. Guided by these core principles, it has established a value system defined by \"Rigor, Solidity, Progress, and Innovation.\"",
      fr: "L'entreprise a introduit totalement des modèles et des moyens de gestion d'entreprise modernes avancés. Adhérant à l'idée d'entreprise « Le client est roi », en utilisant l'amélioration continue et constante de la gestion comme moyens, et en visant à améliorer la satisfaction des clients comme objectif final de l'entreprise, elle a forgé une culture d'entreprise avec des caractéristiques de « Hongyan ». Elle a créé avec soin la marque de « camions lourds » grâce à son service et s'engage fermement sur la voie de la marque et du service.\n\nL'entreprise s'en tient toujours au principe de « l'intégrité en priorité, le Service illimité ». Grâce à la réputation de l'entreprise elle-même, à la qualité de ses produits, aux prix standardisés et à la variété complète des pièces détachées, et avec un service attentionné et chaleureux, elle s'efforce constamment de conquérir de nouveaux clients et d'élargir sa part de marché.\n\nEn même temps, sous la direction de la stratégie macro-marketing de la société Sinotruk SAIC Fiat Hongyan Powertrain Co., Ltd., l'entreprise joue le rôle principal des canaux de marché et saisit les opportunités commerciales.\n\nDe plus, l'entreprise s'en tient à l'idée de culture d'entreprise « La sincérité parfaite est infinie, la générosité est profonde et durable ». Elle accorde une importance égale au développement interne et externe. Sous la guidance de ses idées centrales, elle a formé un système de valeurs de « Rigueur, Solidité, Progression, Innovation ».",
    },
  },
  {
    id: "network",
    titleKey: "company.networkTitle",
    body: {
      zh: "在国内市场，公司为85家经销商、运输企业、4S维修中心以及矿山车队提供服务。同时，公司还是全国62家零部件制造商的代理。\n\n在国际市场方面，公司的业务范围涵盖巴西、俄罗斯、哈萨克斯坦、非洲、中亚、西亚以及东南亚地区。\n\n凭借与国内供应商和服务站点建立的战略合作伙伴关系，公司确保了快速的产品交付、可靠的产品质量以及切实有效的售后服务，从而为客户提供了优质的体验。\n\n「高品质的配套零部件，高效率的亲人般服务」是我们立业育人的根本，也是对每一位客户的承诺和保障。自进入市场以来，我们广受国内外客户的信赖与好评。",
      en: "In the domestic market, the company supplies 85 distributors, transport companies, \"4S\" repair centers, and mining fleets. It also acts as a national representative for 62 spare parts manufacturers.\n\nIn the international market, the company operates in Brazil, Russia, Kazakhstan, Africa, Central Asia, Southwest Asia, and Southeast Asia.\n\nBy leveraging strategic partnerships with domestic suppliers and service stations, the company guarantees rapid delivery, product quality, and effective after-sales support, thereby ensuring an optimal customer experience.\n\n\"High-quality equipment spare parts and highly efficient, family-style service\" form the foundation of our business and our talent development philosophy; they also serve as a promise and a guarantee to each of our customers. Since entering the market, we have earned widespread appreciation and trust from both domestic and international clients.",
      fr: "Sur le marché intérieur, l'entreprise fournit 85 distributeurs, entreprises de transport, centres de réparation 4S et flottes minières. Elle représente également 62 fabricants de pièces détachées à l'échelle nationale.\n\nSur le marché international, elle opère au Brésil, en Russie, au Kazakhstan, en Afrique, en Asie centrale, en Asie du Sud-Ouest et en Asie du Sud-Est.\n\nEn s'appuyant sur des partenariats stratégiques avec des fournisseurs et stations-service nationaux, l'entreprise garantit la rapidité de livraison, la qualité des produits et la pertinence des services après-vente, offrant ainsi une expérience optimale des clients.\n\n« Des pièces détachées d'équipement de haute qualité et un service familial à haute efficacité » sont la base de notre entreprise et de notre éducation des talents, et également une promesse et une garantie pour chacun de nos clients. Depuis notre entrée sur le marché, nous avons été largement appréciés et approuvés par les clients nationaux et internationaux.",
    },
  },
];

export function companyBodyForLocale(
  body: CompanyLocaleBody,
  locale: string
): string {
  if (locale === "zh") return body.zh;
  if (locale === "fr") return body.fr;
  if (locale === "ar") return body.en;
  return body.en;
}
