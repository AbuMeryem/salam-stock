-- ════════════════════════════════════════════════════════════════
-- Seed réaliste Salam Market — démo 12 mai 2026
--
-- Pré-requis : migrations 0001 → 0012 appliquées.
--
-- Contenu :
--   • 8 fournisseurs réels
--   • ~120 produits halal/maghreb crédibles répartis sur 7 catégories
--   • stock_par_depot sur 3 dépôts avec quantités cohérentes
--   • Historique 14 derniers jours :
--       - 25 réceptions
--       - 80 sorties (casse/périmé/défaut) avec scores IA variés
--       - 12 transferts inter-dépôts
--       - 30 commandes Drive
--   • 3 BDL prévus aujourd'hui (12 mai 2026)
--   • 3 alertes en cours (surplus + démarque + sortie suspecte)
-- ════════════════════════════════════════════════════════════════

begin;

-- ─── FOURNISSEURS ──────────────────────────────────────────────
insert into public.fournisseurs (nom, contact_email, contact_telephone, adresse, siret) values
  ('KEREM HALAL', 'commande@keremhalal.fr', '+33 4 78 12 34 56', '24 rue de la République, 69001 Lyon', '802 123 456'),
  ('BOUCHERIE HARRAR', 'contact@harrar.fr', '+33 5 61 22 33 44', '12 av. Jean Jaurès, 31000 Toulouse', '802 234 567'),
  ('MARCHÉ MAGHREB IMPORT', 'orders@mmi-france.com', '+33 4 91 55 66 77', '8 rue Belsunce, 13001 Marseille', '802 345 678'),
  ('METRO TOULOUSE', 'pro@metro.fr', '+33 5 34 30 12 12', 'ZAC de Fenouillet, 31150 Fenouillet', '399 315 613'),
  ('FRANCE FRAIS', 'commandes@francefrais.fr', '+33 1 49 49 50 50', 'Rungis MIN, 94150 Rungis', '662 010 459'),
  ('DAVIGEL', 'service-client@davigel.fr', '+33 2 35 65 65 65', 'Z.I. Eurochannel, 76430 Saint-Vigor-d''Ymonville', '339 567 803'),
  ('COCA-COLA ENTERPRISES', 'distrib@cocacola-entreprises.fr', '+33 1 41 39 39 39', '9 Chemin de Bretagne, 92130 Issy-les-Moulineaux', '343 688 016'),
  ('CRISTALINE FRANCE', 'commandes@cristaline.fr', '+33 1 53 38 09 09', '1 av. Foch, 75116 Paris', '779 050 459')
on conflict do nothing;

-- ─── 120+ PRODUITS RÉALISTES ───────────────────────────────────
-- Les EAN 10000xxx sont des codes internes Salam pour produits maison
-- (boucherie, charcuterie) ; les autres sont des codes commerciaux réels.

insert into public.produits (ean, nom, marque, categorie, image_url, requires_barcode_print) values
  -- BOUCHERIE HALAL (25 produits)
  ('10000001', 'Épaule d''agneau halal 1kg', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/agneau-epaule/400', true),
  ('10000002', 'Gigot d''agneau halal 2kg', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/agneau-gigot/400', true),
  ('10000003', 'Côtelettes d''agneau halal 500g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/agneau-cotelettes/400', true),
  ('10000004', 'Poulet entier halal 1.5kg', 'BOUCHERIE HARRAR', 'Boucherie', 'https://picsum.photos/seed/poulet-entier/400', true),
  ('10000005', 'Poulet halal coupé en 4', 'BOUCHERIE HARRAR', 'Boucherie', 'https://picsum.photos/seed/poulet-coupe/400', true),
  ('10000006', 'Cuisses de poulet halal 1kg', 'BOUCHERIE HARRAR', 'Boucherie', 'https://picsum.photos/seed/poulet-cuisses/400', true),
  ('10000007', 'Blanc de poulet halal 500g', 'BOUCHERIE HARRAR', 'Boucherie', 'https://picsum.photos/seed/poulet-blanc/400', true),
  ('10000008', 'Viande hachée bœuf halal 500g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/boeuf-hache/400', true),
  ('10000009', 'Viande hachée agneau halal 500g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/agneau-hache/400', true),
  ('10000010', 'Bavette bœuf halal 500g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/boeuf-bavette/400', true),
  ('10000011', 'Entrecôte bœuf halal 300g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/boeuf-entrecote/400', true),
  ('10000012', 'Faux-filet bœuf halal 400g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/boeuf-fauxfilet/400', true),
  ('10000013', 'Côte de bœuf halal 1.2kg', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/boeuf-cote/400', true),
  ('10000014', 'Rumsteck bœuf halal 300g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/boeuf-rumsteck/400', true),
  ('10000015', 'Onglet bœuf halal 250g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/boeuf-onglet/400', true),
  ('10000016', 'Tournedos bœuf halal 200g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/boeuf-tournedos/400', true),
  ('10000017', 'Filet mignon agneau halal 400g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/agneau-filet/400', true),
  ('10000018', 'Souris d''agneau halal pièce', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/agneau-souris/400', true),
  ('10000019', 'Tajine prêt à cuire agneau 1kg', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/tajine-agneau/400', true),
  ('10000020', 'Brochettes agneau halal x6', 'BOUCHERIE HARRAR', 'Boucherie', 'https://picsum.photos/seed/brochettes/400', true),
  ('10000021', 'Foie de veau halal 300g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/foie-veau/400', true),
  ('10000022', 'Cœur de poulet halal 500g', 'BOUCHERIE HARRAR', 'Boucherie', 'https://picsum.photos/seed/coeur-poulet/400', true),
  ('10000023', 'Aiguillettes de canard halal 400g', 'BOUCHERIE HARRAR', 'Boucherie', 'https://picsum.photos/seed/canard-aiguil/400', true),
  ('10000024', 'Veau haché halal 500g', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/veau-hache/400', true),
  ('10000025', 'Osso bucco veau halal 1kg', 'KEREM HALAL', 'Boucherie', 'https://picsum.photos/seed/osso-bucco/400', true),

  -- CHARCUTERIE HALAL (15)
  ('10000041', 'Merguez maison Salam 500g', 'BOUCHERIE HARRAR', 'Charcuterie', 'https://picsum.photos/seed/merguez-maison/400', true),
  ('10000042', 'Kefta agneau Salam 500g', 'BOUCHERIE HARRAR', 'Charcuterie', 'https://picsum.photos/seed/kefta/400', true),
  ('10000043', 'Brochettes poulet marinées 500g', 'BOUCHERIE HARRAR', 'Charcuterie', 'https://picsum.photos/seed/brochettes-poul/400', true),
  ('10000044', 'Saucisses de bœuf halal x6', 'BOUCHERIE HARRAR', 'Charcuterie', 'https://picsum.photos/seed/saucisses/400', true),
  ('10000045', 'Pâté de poulet halal 200g', 'ISLA MONDIAL', 'Charcuterie', 'https://picsum.photos/seed/pate-poulet/400', true),
  ('10000046', 'Mortadelle dinde halal 200g', 'ISLA DELICE', 'Charcuterie', 'https://picsum.photos/seed/mortadelle/400', false),
  ('10000047', 'Bresaola halal 100g', 'ISLA DELICE', 'Charcuterie', 'https://picsum.photos/seed/bresaola/400', false),
  ('10000048', 'Saucisson dinde halal 250g', 'ISLA DELICE', 'Charcuterie', 'https://picsum.photos/seed/saucisson/400', false),
  ('10000049', 'Jambon de dinde fumé halal 200g', 'ISLA DELICE', 'Charcuterie', 'https://picsum.photos/seed/jambon-dinde/400', false),
  ('10000050', 'Knack de volaille halal x10', 'WASSILA', 'Charcuterie', 'https://picsum.photos/seed/knack/400', false),
  ('10000051', 'Chorizo halal 200g', 'WASSILA', 'Charcuterie', 'https://picsum.photos/seed/chorizo/400', false),
  ('10000052', 'Pastrami halal 150g', 'ISLA DELICE', 'Charcuterie', 'https://picsum.photos/seed/pastrami/400', false),
  ('10000053', 'Bacon de bœuf halal 150g', 'ISLA DELICE', 'Charcuterie', 'https://picsum.photos/seed/bacon-boeuf/400', false),
  ('10000054', 'Cordon bleu halal x4', 'ISLA DELICE', 'Charcuterie', 'https://picsum.photos/seed/cordon-bleu/400', false),
  ('10000055', 'Nuggets halal x10', 'ISLA DELICE', 'Charcuterie', 'https://picsum.photos/seed/nuggets/400', false),

  -- ÉPICERIE MAGHREB (30)
  ('3033710073610', 'Couscous fin moyen Ferrero 1kg', 'FERRERO', 'Épicerie', 'https://picsum.photos/seed/couscous-fin/400', false),
  ('3033710071234', 'Semoule fine 1kg', 'FERRERO', 'Épicerie', 'https://picsum.photos/seed/semoule/400', false),
  ('6191500110001', 'Harissa Le Phare du Cap Bon 140g', 'CAP BON', 'Épicerie', 'https://picsum.photos/seed/harissa/400', false),
  ('3270190123456', 'Ras el hanout Carrefour 50g', 'CARREFOUR', 'Épicerie', 'https://picsum.photos/seed/ras-hanout/400', false),
  ('3270190123463', 'Cumin moulu 50g', 'DUCROS', 'Épicerie', 'https://picsum.photos/seed/cumin/400', false),
  ('3270190123464', 'Cannelle moulue 40g', 'DUCROS', 'Épicerie', 'https://picsum.photos/seed/cannelle/400', false),
  ('3270190123465', 'Curcuma 40g', 'DUCROS', 'Épicerie', 'https://picsum.photos/seed/curcuma/400', false),
  ('3270190123466', 'Gingembre moulu 40g', 'DUCROS', 'Épicerie', 'https://picsum.photos/seed/gingembre/400', false),
  ('3270190123467', 'Paprika 50g', 'DUCROS', 'Épicerie', 'https://picsum.photos/seed/paprika/400', false),
  ('6191500220001', 'Dattes Deglet Nour 500g', 'OASIS DU SUD', 'Épicerie', 'https://picsum.photos/seed/dattes-deglet/400', false),
  ('6191500220018', 'Dattes Medjool premium 500g', 'OASIS DU SUD', 'Épicerie', 'https://picsum.photos/seed/dattes-medjool/400', false),
  ('3270190567890', 'Miel de fleurs naturel 500g', 'LUNE DE MIEL', 'Épicerie', 'https://picsum.photos/seed/miel/400', false),
  ('3270190567891', 'Miel de jujubier 250g', 'APIDIS', 'Épicerie', 'https://picsum.photos/seed/miel-jujub/400', false),
  ('6191500330001', 'Huile d''olive vierge extra Tunisie 1L', 'CARTHAGO', 'Épicerie', 'https://picsum.photos/seed/huile-olive/400', false),
  ('3270190567123', 'Huile de tournesol 1L Carrefour', 'CARREFOUR', 'Épicerie', 'https://picsum.photos/seed/huile-tourn/400', false),
  ('3270190567130', 'Huile d''argan alimentaire 250ml', 'BLEDINA', 'Épicerie', 'https://picsum.photos/seed/argan/400', false),
  ('5011157102251', 'Riz Basmati Tilda 5kg', 'TILDA', 'Épicerie', 'https://picsum.photos/seed/riz-basmati/400', false),
  ('5011157102252', 'Riz Basmati Tilda 1kg', 'TILDA', 'Épicerie', 'https://picsum.photos/seed/riz-basmati-1kg/400', false),
  ('6111034567890', 'Couscous moyen Dari 1kg', 'DARI', 'Épicerie', 'https://picsum.photos/seed/couscous-dari/400', false),
  ('3083680034400', 'Pois chiches secs 1kg', 'BONDUELLE', 'Épicerie', 'https://picsum.photos/seed/pois-chiches/400', false),
  ('3083680034401', 'Lentilles corail 500g', 'BONDUELLE', 'Épicerie', 'https://picsum.photos/seed/lentilles/400', false),
  ('3083680034402', 'Haricots blancs secs 500g', 'BONDUELLE', 'Épicerie', 'https://picsum.photos/seed/haricots-blancs/400', false),
  ('3700777888999', 'Loukoum aux pistaches 200g', 'MAAMORA', 'Épicerie', 'https://picsum.photos/seed/loukoum/400', false),
  ('3760123456044', 'Halawa pistache 400g', 'MAAMORA', 'Épicerie', 'https://picsum.photos/seed/halawa/400', false),
  ('3760123456001', 'Olives Picholine vrac 1kg', 'MAAMORA', 'Épicerie', 'https://picsum.photos/seed/olives/400', false),
  ('3700333444555', 'Thé vert Sultan en vrac 250g', 'SULTAN', 'Épicerie', 'https://picsum.photos/seed/the-sultan/400', false),
  ('3700333444556', 'Thé à la menthe Tetley x25', 'TETLEY', 'Épicerie', 'https://picsum.photos/seed/the-menthe/400', false),
  ('6111034567891', 'Couscous gros Dari 1kg', 'DARI', 'Épicerie', 'https://picsum.photos/seed/couscous-gros/400', false),
  ('6111034567892', 'Tagliatelle Dari 500g', 'DARI', 'Épicerie', 'https://picsum.photos/seed/tagliatelle/400', false),
  ('3270190123468', 'Eau de fleur d''oranger 250ml', 'MARNIER', 'Épicerie', 'https://picsum.photos/seed/fleur-oranger/400', false),

  -- PRODUITS FRAIS (20)
  ('3033491001234', 'Yaourt nature Danone x4', 'DANONE', 'Frais', 'https://picsum.photos/seed/yaourt-nature/400', false),
  ('3033491001235', 'Yaourt Activia nature x4', 'DANONE', 'Frais', 'https://picsum.photos/seed/activia/400', false),
  ('3057640501234', 'Fromage halal Président 250g', 'PRESIDENT', 'Frais', 'https://picsum.photos/seed/fromage-pres/400', false),
  ('3057640507890', 'Beurre Président 250g', 'PRESIDENT', 'Frais', 'https://picsum.photos/seed/beurre/400', false),
  ('3270190001234', 'Œufs frais Label Rouge x6', 'CARREFOUR', 'Frais', 'https://picsum.photos/seed/oeufs/400', false),
  ('3270190001235', 'Œufs bio Label Bio x10', 'CARREFOUR BIO', 'Frais', 'https://picsum.photos/seed/oeufs-bio/400', false),
  ('3428272411234', 'Lait demi-écrémé Lactel 1L', 'LACTEL', 'Frais', 'https://picsum.photos/seed/lait/400', false),
  ('3428272411235', 'Lait entier Lactel 1L', 'LACTEL', 'Frais', 'https://picsum.photos/seed/lait-entier/400', false),
  ('3155251200321', 'Fromage feta 200g', 'SALAKIS', 'Frais', 'https://picsum.photos/seed/feta/400', false),
  ('3155251200322', 'Mozzarella di Bufala 250g', 'GALBANI', 'Frais', 'https://picsum.photos/seed/mozza/400', false),
  ('6191055443322', 'Bricks Tunisiens x10', 'SIDI MANSOUR', 'Frais', 'https://picsum.photos/seed/bricks/400', false),
  ('6191055443323', 'Pâtes Filo 500g', 'SIDI MANSOUR', 'Frais', 'https://picsum.photos/seed/filo/400', false),
  ('3155251200323', 'Yaourt grec nature 4×150g', 'FAGE', 'Frais', 'https://picsum.photos/seed/yaourt-grec/400', false),
  ('3155251200324', 'Fromage blanc 1kg', 'YOPLAIT', 'Frais', 'https://picsum.photos/seed/fromage-blanc/400', false),
  ('3057640507891', 'Camembert Président 250g', 'PRESIDENT', 'Frais', 'https://picsum.photos/seed/camembert/400', false),
  ('3057640507892', 'Brie Président 200g', 'PRESIDENT', 'Frais', 'https://picsum.photos/seed/brie/400', false),
  ('3270190001236', 'Crème fraîche épaisse 30cl', 'ELLE & VIRE', 'Frais', 'https://picsum.photos/seed/creme/400', false),
  ('3270190001237', 'Crème liquide entière 25cl', 'ELLE & VIRE', 'Frais', 'https://picsum.photos/seed/creme-liq/400', false),
  ('3270190001238', 'Boursin ail et fines herbes 150g', 'BOURSIN', 'Frais', 'https://picsum.photos/seed/boursin/400', false),
  ('3270190001239', 'Mascarpone Galbani 250g', 'GALBANI', 'Frais', 'https://picsum.photos/seed/mascarpone/400', false),

  -- SURGELÉS (15)
  ('3270190234567', 'Filets de cabillaud surgelés 600g', 'PICARD', 'Surgelés', 'https://picsum.photos/seed/cabillaud/400', false),
  ('3270190234574', 'Crevettes décortiquées 500g', 'PICARD', 'Surgelés', 'https://picsum.photos/seed/crevettes/400', false),
  ('3270190234581', 'Pizza halal merguez 400g', 'DR OETKER', 'Surgelés', 'https://picsum.photos/seed/pizza/400', false),
  ('3270190234598', 'Légumes ratatouille 600g', 'PICARD', 'Surgelés', 'https://picsum.photos/seed/ratatouille/400', false),
  ('3270190234599', 'Épinards en branches 800g', 'PICARD', 'Surgelés', 'https://picsum.photos/seed/epinards/400', false),
  ('3270190234600', 'Frites surgelées McCain 1kg', 'MCCAIN', 'Surgelés', 'https://picsum.photos/seed/frites/400', false),
  ('3270190234601', 'Glace Magnum Classic x4', 'MAGNUM', 'Surgelés', 'https://picsum.photos/seed/magnum/400', false),
  ('3270190234602', 'Glace Häagen-Dazs vanille 460ml', 'HAAGEN-DAZS', 'Surgelés', 'https://picsum.photos/seed/glace-vanille/400', false),
  ('3270190234603', 'Pâte feuilletée surgelée 230g', 'CROUSTIPATE', 'Surgelés', 'https://picsum.photos/seed/pate-feuil/400', false),
  ('3270190234604', 'Saumon fumé surgelé 200g', 'LABEYRIE', 'Surgelés', 'https://picsum.photos/seed/saumon/400', false),
  ('3270190234605', 'Brochettes scampi surgelées 400g', 'PICARD', 'Surgelés', 'https://picsum.photos/seed/scampi/400', false),
  ('3270190234606', 'Mélange fruits rouges 500g', 'PICARD', 'Surgelés', 'https://picsum.photos/seed/fruits-rouges/400', false),
  ('3270190234607', 'Petits pois extra fins 1kg', 'PICARD', 'Surgelés', 'https://picsum.photos/seed/petits-pois/400', false),
  ('3270190234608', 'Calamars en anneaux 400g', 'PICARD', 'Surgelés', 'https://picsum.photos/seed/calamars/400', false),
  ('3270190234609', 'Filets de daurade 500g', 'PICARD', 'Surgelés', 'https://picsum.photos/seed/daurade/400', false),

  -- BOISSONS (15)
  ('5449000131836', 'Coca-Cola Zero 1.5L', 'COCA-COLA', 'Boissons', 'https://picsum.photos/seed/coca-zero/400', false),
  ('5449000131835', 'Fanta Orange 1.5L', 'FANTA', 'Boissons', 'https://picsum.photos/seed/fanta/400', false),
  ('5449000131837', 'Sprite 1.5L', 'COCA-COLA', 'Boissons', 'https://picsum.photos/seed/sprite/400', false),
  ('5449000131838', 'Coca-Cola Original 1.5L', 'COCA-COLA', 'Boissons', 'https://picsum.photos/seed/coca-orig/400', false),
  ('3068320114040', 'Eau Cristaline 1.5L', 'CRISTALINE', 'Boissons', 'https://picsum.photos/seed/cristaline/400', false),
  ('3068320114041', 'Eau Évian 1.5L', 'EVIAN', 'Boissons', 'https://picsum.photos/seed/evian/400', false),
  ('3068320114042', 'Eau Volvic 1.5L', 'VOLVIC', 'Boissons', 'https://picsum.photos/seed/volvic/400', false),
  ('8001070000123', 'Jus orange Tropicana 1L', 'TROPICANA', 'Boissons', 'https://picsum.photos/seed/orange/400', false),
  ('8001070000124', 'Jus multifruits Joker 1L', 'JOKER', 'Boissons', 'https://picsum.photos/seed/multifruits/400', false),
  ('3034210123456', 'Sirop de menthe Teisseire 60cl', 'TEISSEIRE', 'Boissons', 'https://picsum.photos/seed/sirop-menthe/400', false),
  ('3034210123457', 'Sirop de grenadine Teisseire 60cl', 'TEISSEIRE', 'Boissons', 'https://picsum.photos/seed/grenadine/400', false),
  ('6224000180071', 'Freez Mix Grenadine 275ml', 'FREEZ', 'Boissons', 'https://picsum.photos/seed/freez-gren/400', false),
  ('6224000180072', 'Freez Mix Litchi 275ml', 'FREEZ', 'Boissons', 'https://picsum.photos/seed/freez-litchi/400', false),
  ('3068320114043', 'Eau pétillante Perrier 1L', 'PERRIER', 'Boissons', 'https://picsum.photos/seed/perrier/400', false),
  ('3068320114044', 'Limonade Lorina 75cl', 'LORINA', 'Boissons', 'https://picsum.photos/seed/limonade/400', false),

  -- HYGIÈNE & ÉPICERIE FINE (10)
  ('3270190345678', 'Savon de Marseille 300g', 'LE PETIT MARSEILLAIS', 'Hygiène', 'https://picsum.photos/seed/savon/400', false),
  ('5410076403225', 'Liquide vaisselle Paic 750ml', 'PAIC', 'Hygiène', 'https://picsum.photos/seed/paic/400', false),
  ('8001841478821', 'Lessive liquide Ariel 2L', 'ARIEL', 'Hygiène', 'https://picsum.photos/seed/ariel/400', false),
  ('7322540500127', 'Papier toilette Lotus x12', 'LOTUS', 'Hygiène', 'https://picsum.photos/seed/lotus/400', false),
  ('7322540500128', 'Essuie-tout Lotus x4', 'LOTUS', 'Hygiène', 'https://picsum.photos/seed/essuie-tout/400', false),
  ('7322540500129', 'Mouchoirs Kleenex boîte x100', 'KLEENEX', 'Hygiène', 'https://picsum.photos/seed/kleenex/400', false),
  ('3270190345679', 'Eau de rose 250ml', 'CORTAS', 'Hygiène', 'https://picsum.photos/seed/eau-rose/400', false),
  ('3270190345680', 'Henné cheveux 100g', 'KHADI', 'Hygiène', 'https://picsum.photos/seed/henne/400', false),
  ('3270190345681', 'Savon noir 200g', 'LE PETIT MARSEILLAIS', 'Hygiène', 'https://picsum.photos/seed/savon-noir/400', false),
  ('3270190345682', 'Shampoing Garnier Ultra Doux 250ml', 'GARNIER', 'Hygiène', 'https://picsum.photos/seed/shampoing/400', false)
on conflict (ean) do nothing;

-- ─── STOCK PAR DÉPÔT ──────────────────────────────────────────
-- Heuristique : Particulier 5-30 unités, Pro 20-100, Sodrune 100-500.
-- Prix indicatif par catégorie. On utilise un setseed pour reproductibilité.

do $$
begin
  perform setseed(0.42);
end$$;

insert into public.stock_par_depot (produit_id, depot_id, quantite, prix_vente, is_visible)
select
  p.id,
  d.id,
  case d.nom
    when 'Particulier'   then 5  + (random() * 25)::int
    when 'Professionnel' then 20 + (random() * 80)::int
    when 'Sodrune'       then 100 + (random() * 400)::int
    else 10
  end as quantite,
  case p.categorie
    when 'Boucherie'   then 8 + (random() * 30)::numeric(10,2)
    when 'Charcuterie' then 4 + (random() * 8)::numeric(10,2)
    when 'Frais'       then 1.5 + (random() * 5)::numeric(10,2)
    when 'Surgelés'    then 4 + (random() * 10)::numeric(10,2)
    when 'Boissons'    then 0.8 + (random() * 3)::numeric(10,2)
    when 'Hygiène'     then 2 + (random() * 12)::numeric(10,2)
    when 'Épicerie'    then 1.5 + (random() * 10)::numeric(10,2)
    else 5
  end as prix_vente,
  true
from public.produits p
cross join public.depots d
where p.ean like '10000%' or p.ean in (
  '3033710073610','3033710071234','6191500110001','3270190123456','3270190123463','3270190123464','3270190123465','3270190123466','3270190123467',
  '6191500220001','6191500220018','3270190567890','3270190567891','6191500330001','3270190567123','3270190567130',
  '5011157102251','5011157102252','6111034567890','3083680034400','3083680034401','3083680034402',
  '3700777888999','3760123456044','3760123456001','3700333444555','3700333444556','6111034567891','6111034567892','3270190123468',
  '3033491001234','3033491001235','3057640501234','3057640507890','3270190001234','3270190001235','3428272411234','3428272411235',
  '3155251200321','3155251200322','6191055443322','6191055443323','3155251200323','3155251200324','3057640507891','3057640507892',
  '3270190001236','3270190001237','3270190001238','3270190001239',
  '3270190234567','3270190234574','3270190234581','3270190234598','3270190234599','3270190234600','3270190234601','3270190234602',
  '3270190234603','3270190234604','3270190234605','3270190234606','3270190234607','3270190234608','3270190234609',
  '5449000131836','5449000131835','5449000131837','5449000131838','3068320114040','3068320114041','3068320114042',
  '8001070000123','8001070000124','3034210123456','3034210123457','6224000180071','6224000180072','3068320114043','3068320114044',
  '3270190345678','5410076403225','8001841478821','7322540500127','7322540500128','7322540500129','3270190345679','3270190345680','3270190345681','3270190345682'
)
on conflict (produit_id, depot_id) do update set quantite = excluded.quantite, prix_vente = excluded.prix_vente;

-- ─── HISTORIQUE — RÉCEPTIONS 14 DERNIERS JOURS ────────────────
-- 25 réceptions : variation de fournisseurs, jours, dépôts.
-- Génère via INSERT...SELECT depuis generate_series.

with rec_data as (
  select
    g.n,
    (now() - (g.n * interval '12 hours')) as ts,
    case (g.n % 4)
      when 0 then 'KEREM HALAL'
      when 1 then 'MARCHÉ MAGHREB IMPORT'
      when 2 then 'FRANCE FRAIS'
      else 'METRO TOULOUSE'
    end as fournisseur,
    'BL-2026-' || (140 - g.n)::text as numero_bl
  from generate_series(1, 25) g(n)
)
insert into public.receptions (depot_id, employe_id, fournisseur, numero_bl, photo_url, statut, created_at)
select
  (select id from public.depots order by random() limit 1),
  (select id from public.employes where prenom = 'Otmane' limit 1),
  rd.fournisseur,
  rd.numero_bl,
  'https://picsum.photos/seed/recep' || rd.n || '/400',
  'validee',
  rd.ts
from rec_data rd
where rd.ts > (now() - interval '14 days');

-- Ajoute des lignes (3-7 par réception) pour étoffer le visuel
insert into public.receptions_lignes (reception_id, produit_id, code_scanne, quantite_scannee, quantite_calculee)
select
  r.id,
  p.id,
  p.ean,
  (3 + (random() * 12)::int),
  (3 + (random() * 12)::int)
from public.receptions r
cross join lateral (
  select id, ean from public.produits where ean like '10000%' or ean like '3033%' order by random() limit (3 + (random() * 4)::int)
) p
where r.created_at > (now() - interval '14 days');

-- ─── HISTORIQUE — SORTIES 14 DERNIERS JOURS ───────────────────
-- 80 sorties avec scores IA variés (0.42 à 0.95). Permet d'alimenter
-- le dashboard alertes + les KPI démarque.

do $$
begin
  perform setseed(0.7);
end$$;

with type_pool as (
  select unnest(array[
    'casse_manipulation','casse_client','perime_dlc','perime_ddm','defaut_fournisseur','autre'
  ]) as t
)
insert into public.sorties_stock (
  depot_id, employe_id, produit_id, type, motif_libre, quantite, photo_url,
  ia_coherence_score, ia_coherence_notes, created_at
)
select
  (select id from public.depots order by random() limit 1),
  (select id from public.employes order by random() limit 1),
  p.id,
  (select t from type_pool order by random() limit 1),
  case (g.n % 3)
    when 0 then 'Carton endommagé à la livraison'
    when 1 then 'DLC dépassée constatée en rayon'
    else 'Manipulation cliente'
  end,
  1 + (random() * 6)::int,
  'https://picsum.photos/seed/sortie' || g.n || '/400',
  case
    when g.n % 12 = 0 then 0.42  -- alerte rouge
    when g.n % 9 = 0 then 0.58
    when g.n % 6 = 0 then 0.71
    else 0.85 + (random() * 0.13)
  end::numeric(3,2),
  case
    when g.n % 12 = 0 then 'Photo floue, motif peu cohérent — vérification recommandée'
    when g.n % 9 = 0 then 'Quantité élevée, contexte à clarifier'
    else 'Cohérence OK'
  end,
  now() - (g.n * interval '4 hours') - ((random() * 3) || ' hours')::interval
from generate_series(1, 80) g(n)
cross join lateral (
  select id from public.produits where categorie in ('Frais','Boucherie','Boissons','Surgelés') order by random() limit 1
) p
where (now() - (g.n * interval '4 hours')) > (now() - interval '14 days');

-- ─── HISTORIQUE — TRANSFERTS INTER-DÉPÔTS ─────────────────────
-- 12 transferts crédibles entre les 3 dépôts.

with transfert_data as (
  select g.n, now() - (g.n * interval '1 day') as ts from generate_series(1, 12) g(n)
)
insert into public.transferts_inter_depots (
  depot_source_id, depot_destination_id, produit_id, quantite, employe_id, photo_url, created_at
)
select
  src.id,
  dst.id,
  p.id,
  5 + (random() * 30)::int,
  (select id from public.employes order by random() limit 1),
  'https://picsum.photos/seed/transfert' || td.n || '/400',
  td.ts
from transfert_data td
cross join lateral (select id from public.depots order by random() limit 1) src
cross join lateral (select id from public.depots where id <> src.id order by random() limit 1) dst
cross join lateral (select id from public.produits order by random() limit 1) p;

-- ─── HISTORIQUE — COMMANDES DRIVE 7 DERNIERS JOURS ────────────
-- 30 commandes Drive avec total cohérent. Stripe pour ~60%.

with cmd_data as (
  select
    g.n,
    'CMD-2026-D' || lpad(g.n::text, 4, '0') as num,
    case (g.n % 4) when 0 then 'Aïcha Belkacem' when 1 then 'Mohamed Tahar' when 2 then 'Yasmine Ait Lahcen' else 'Karim Benbouali' end as client,
    now() - (g.n * interval '6 hours') as ts,
    case when g.n % 5 = 0 then 'en_magasin' else 'stripe' end as paiement,
    case when g.n % 7 = 0 then 'en_preparation' when g.n % 7 in (1,2) then 'pret' else 'retire' end as statut
  from generate_series(1, 30) g(n)
)
insert into public.commandes_drive (
  numero_commande, client_nom, client_telephone, creneau_retrait, statut,
  total_ttc, mode_paiement, created_at
)
select
  cd.num, cd.client,
  '+33 6 ' || lpad((10000000 + (random() * 89999999)::int)::text, 8, '0'),
  cd.ts + interval '2 hours',
  cd.statut,
  18.50 + (random() * 80)::numeric(10,2),
  cd.paiement,
  cd.ts
from cmd_data cd
where cd.ts > (now() - interval '7 days')
on conflict (numero_commande) do nothing;

-- Lignes des commandes Drive (3-5 par commande)
insert into public.commandes_drive_lignes (
  commande_id, produit_id, depot_id, quantite, prix_unitaire, statut_preparation
)
select
  c.id,
  p.id,
  (select id from public.depots where nom = 'Particulier' limit 1),
  1 + (random() * 3)::int,
  s.prix_vente,
  case when c.statut = 'retire' then 'prepare' else 'en_attente' end
from public.commandes_drive c
cross join lateral (
  select id from public.produits where ean like '3033%' or ean like '3057%' or ean like '5449%' or ean like '6191%' or ean like '10000%'
  order by random() limit (3 + (random() * 3)::int)
) p
left join public.stock_par_depot s on s.produit_id = p.id and s.depot_id = (select id from public.depots where nom = 'Particulier' limit 1)
where c.created_at > (now() - interval '7 days');

-- ─── 3 BDL ATTENDUS AUJOURD'HUI (12 MAI 2026) ────────────────
-- Important : current_date doit valoir 2026-05-12 le jour de la démo.

insert into public.bons_de_livraison (
  numero_bdl, fournisseur_id, depot_destination_id, date_livraison_prevue, statut, notes
) values
  ('2026-0142',
   (select id from public.fournisseurs where nom = 'KEREM HALAL'),
   (select id from public.depots where nom = 'Particulier'),
   current_date,
   'prevue',
   'Livraison 10h-11h. 8 produits boucherie/charcuterie.'),
  ('2026-0143',
   (select id from public.fournisseurs where nom = 'MARCHÉ MAGHREB IMPORT'),
   (select id from public.depots where nom = 'Professionnel'),
   current_date,
   'prevue',
   'Livraison 14h-16h. 25 produits épicerie maghreb.'),
  ('2026-0144',
   (select id from public.fournisseurs where nom = 'FRANCE FRAIS'),
   (select id from public.depots where nom = 'Particulier'),
   current_date,
   'prevue',
   'Livraison 07h-08h. 15 produits frais.')
on conflict do nothing;

-- Lignes du BDL KEREM (8 produits boucherie)
insert into public.bons_de_livraison_lignes (bdl_id, produit_id, code_barre_attendu, quantite_attendue)
select
  (select id from public.bons_de_livraison where numero_bdl = '2026-0142'),
  p.id, p.ean,
  case p.ean
    when '10000001' then 10 when '10000002' then 8 when '10000004' then 24
    when '10000006' then 16 when '10000008' then 20 when '10000020' then 30
    when '10000041' then 25 when '10000042' then 20 else 10
  end
from public.produits p
where p.ean in ('10000001','10000002','10000004','10000006','10000008','10000020','10000041','10000042');

-- Lignes du BDL MAGHREB (15 produits épicerie pour la démo)
insert into public.bons_de_livraison_lignes (bdl_id, produit_id, code_barre_attendu, quantite_attendue)
select
  (select id from public.bons_de_livraison where numero_bdl = '2026-0143'),
  p.id, p.ean, 10 + (random() * 30)::int
from public.produits p
where p.ean in (
  '3033710073610','3033710071234','6191500110001','3270190123456','3270190123463',
  '6191500220001','6191500220018','3270190567890','6191500330001','3270190567123',
  '5011157102251','6111034567890','3083680034400','3700777888999','3760123456044'
);

-- Lignes du BDL FRANCE FRAIS (15 produits)
insert into public.bons_de_livraison_lignes (bdl_id, produit_id, code_barre_attendu, quantite_attendue)
select
  (select id from public.bons_de_livraison where numero_bdl = '2026-0144'),
  p.id, p.ean, 12 + (random() * 24)::int
from public.produits p
where p.ean in (
  '3033491001234','3033491001235','3057640501234','3057640507890','3270190001234',
  '3270190001235','3428272411234','3428272411235','3155251200321','3155251200322',
  '6191055443322','6191055443323','3057640507891','3270190001236','3270190001238'
);

-- ─── ALERTE SURPLUS — KEREM a livré 12 cuisses en plus ─────────
insert into public.alertes_surplus (
  bdl_id, code_barre_scanne, produit_id, quantite_surplus,
  signale_par, signale_le, statut, notes
) values (
  null,  -- pas lié à un BDL d'aujourd'hui, c'est l'historique
  '10000006',
  (select id from public.produits where ean = '10000006'),
  12,
  (select id from public.employes where prenom = 'Otmane' limit 1),
  now() - interval '1 day',
  'en_attente',
  'Reçu hier sur BDL 2026-0138 — KEREM a livré 12 cuisses en plus du bon. À refacturer au fournisseur après accord Otmane/Ahmed.'
);

commit;

-- Notification PostgREST pour rafraîchir le cache schema
notify pgrst, 'reload schema';
