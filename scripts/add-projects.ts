import { ethers } from "ethers";
import { CONFIG } from "../src/lib/config";
import { createClient } from "@supabase/supabase-js";

const provider = new ethers.JsonRpcProvider(CONFIG.infuraApiUrl);
const wallet = new ethers.Wallet(CONFIG.privateKey, provider);

const FACTORY_ABI = [
  "function createToken(string _projectId, string _name, string _symbol, uint256 _maxSupply) external returns (address)",
  "function getToken(string _projectId) external view returns (address)",
];
const MANAGER_ABI = [
  "function registerProject(string _projectId) external",
];
const PT_ABI = [
  "function setManager(address _manager) external",
];

const factory = new ethers.Contract(CONFIG.projectTokenFactoryAddress, FACTORY_ABI, wallet);
const manager = new ethers.Contract(CONFIG.creditManagerAddress, MANAGER_ABI, wallet);
const supabase = createClient(CONFIG.supabaseUri, CONFIG.supabaseServiceRoleKey);

const newProjects = [
  {
    name: "Kenya Great Rift Solar Farm",
    status: "trading",
    price: 14,
    available_shares: 9000,
    totalShares: 9000,
    location: "Nakuru, Kenya",
    type: "Solar Energy",
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800",
    growth: "+10.2%",
    weight: 2,
    description: "A 50 MW solar photovoltaic installation in the Great Rift Valley, delivering clean electricity to 30,000 households across Nakuru County. The project displaces diesel generators and reduces 45,000 tCO₂e annually. Built on degraded farmland unsuitable for agriculture, it provides jobs for 300+ local workers and funds community schools.",
    attributes: { arr: "12.8%", irr: "15.5%", nftSymbol: "KGSF", sharePerNFT: 1, propertyType: "Solar PV", carbonCredits: 9000, initialSharePrice: 14, initialPropertyValue: 126000 },
    value_parameters: [{ roi: 15.5, rentalYield: 0, appreciation: 10.2 }, { roi: 13.8, rentalYield: 0, appreciation: 9.1 }],
    progress: [{ id: "1", title: "Site Survey Complete", isDone: true }, { id: "2", title: "Panel Installation", isDone: true }, { id: "3", title: "Grid Connected", isDone: true }, { id: "4", title: "Phase 2 Expansion", isDone: false }],
    Highlights: [{ title: "50 MW Capacity", description: "Utility-scale solar in the Great Rift Valley" }, { title: "30,000 Households", description: "Clean energy for Nakuru County" }, { title: "45,000 tCO₂e/year", description: "Annual emission reductions" }, { title: "300+ Jobs Created", description: "Direct employment for local communities" }],
    Documents: ["Verra VCS Certificate", "Grid Connection License", "Environmental Assessment"],
  },
  {
    name: "Borneo Peatland Restoration",
    status: "trading",
    price: 20,
    available_shares: 7000,
    totalShares: 7000,
    location: "Central Kalimantan, Indonesia",
    type: "Peatland",
    image: "https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=800",
    growth: "+14.1%",
    weight: 3,
    description: "Rewetting and restoring 85,000 hectares of degraded tropical peatlands in Central Kalimantan. Peatlands store 10x more carbon per hectare than any other ecosystem. The project blocks illegal drainage canals, reintroduces native peat swamp species, and prevents catastrophic peat fires that historically released massive CO₂ plumes visible from space.",
    attributes: { arr: "15.2%", irr: "19.8%", nftSymbol: "BPR", sharePerNFT: 1, propertyType: "Peatland Restoration", carbonCredits: 7000, initialSharePrice: 20, initialPropertyValue: 140000 },
    value_parameters: [{ roi: 19.8, rentalYield: 0, appreciation: 14.1 }, { roi: 17.5, rentalYield: 0, appreciation: 12.3 }],
    progress: [{ id: "1", title: "Canal Blocking Phase 1", isDone: true }, { id: "2", title: "Rewetting Complete", isDone: true }, { id: "3", title: "Native Species Planting", isDone: true }, { id: "4", title: "Fire Prevention System", isDone: false }],
    Highlights: [{ title: "85,000 Hectares", description: "One of the largest peatland restoration projects" }, { title: "10x Carbon Density", description: "Peat stores 10x more carbon than forests" }, { title: "Fire Prevention", description: "Stopping catastrophic peat fires" }, { title: "REDD+ Certified", description: "Under UNFCCC framework" }],
    Documents: ["REDD+ Registration", "Peat Depth Survey", "Fire Risk Assessment", "Community Agreement"],
  },
  {
    name: "Scottish Highland Wind Farm",
    status: "trading",
    price: 25,
    available_shares: 5000,
    totalShares: 5000,
    location: "Inverness, Scotland",
    type: "Wind Energy",
    image: "https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=800",
    growth: "+7.5%",
    weight: 2,
    description: "A 120 MW onshore wind farm comprising 30 turbines across the Scottish Highlands near Inverness. Generates 350,000 MWh annually — enough for 90,000 homes. The project includes habitat management for red deer and golden eagles, and contributes £2M annually to a community benefit fund for local Highland villages.",
    attributes: { arr: "9.5%", irr: "12.2%", nftSymbol: "SHW", sharePerNFT: 1, propertyType: "Onshore Wind", carbonCredits: 5000, initialSharePrice: 25, initialPropertyValue: 125000 },
    value_parameters: [{ roi: 12.2, rentalYield: 0, appreciation: 7.5 }, { roi: 11.0, rentalYield: 0, appreciation: 6.8 }],
    progress: [{ id: "1", title: "Planning Permission", isDone: true }, { id: "2", title: "Turbine Installation", isDone: true }, { id: "3", title: "Grid Export Active", isDone: true }, { id: "4", title: "Repowering Study", isDone: false }],
    Highlights: [{ title: "120 MW Capacity", description: "30 turbines across the Highlands" }, { title: "350,000 MWh/year", description: "Powering 90,000 homes annually" }, { title: "£2M Community Fund", description: "Annual investment in local villages" }, { title: "Wildlife Management", description: "Golden eagle and red deer protection" }],
    Documents: ["UK Ofgem Certificate", "Wildlife Impact Report", "Grid Export Agreement"],
  },
  {
    name: "Amazon REDD+ Conservation",
    status: "launchpad",
    price: 11,
    available_shares: 20000,
    totalShares: 20000,
    location: "Amazonas, Brazil",
    type: "REDD+",
    image: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
    growth: "+11.8%",
    weight: 3,
    description: "Protecting 180,000 hectares of pristine Amazon rainforest in Amazonas state from illegal logging and land conversion. The project employs 50 forest rangers, operates satellite monitoring stations, and supports 12 indigenous communities with sustainable livelihood programs. Verified under VCS with CCB Gold Level for exceptional biodiversity benefits.",
    attributes: { arr: "13.5%", irr: "16.8%", nftSymbol: "AMZN", sharePerNFT: 1, propertyType: "Forest Conservation", carbonCredits: 20000, initialSharePrice: 11, initialPropertyValue: 220000 },
    value_parameters: [{ roi: 16.8, rentalYield: 0, appreciation: 11.8 }, { roi: 14.5, rentalYield: 0, appreciation: 10.2 }],
    progress: [{ id: "1", title: "VCS Registration", isDone: true }, { id: "2", title: "Ranger Deployment", isDone: true }, { id: "3", title: "Satellite Monitoring", isDone: false }, { id: "4", title: "Community Programs", isDone: false }],
    Highlights: [{ title: "180,000 Hectares", description: "Protecting pristine Amazon rainforest" }, { title: "CCB Gold Level", description: "Exceptional biodiversity recognition" }, { title: "12 Indigenous Communities", description: "Sustainable livelihood support" }, { title: "50 Forest Rangers", description: "24/7 anti-deforestation patrol" }],
    Documents: ["VCS Certificate", "CCB Gold Assessment", "Indigenous Community MoU"],
  },
  {
    name: "Madagascar Mangrove Blue Carbon",
    status: "launchpad",
    price: 9,
    available_shares: 11000,
    totalShares: 11000,
    location: "Mahajanga, Madagascar",
    type: "Blue Carbon",
    image: "https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=800",
    growth: "+8.9%",
    weight: 1,
    description: "Restoring 15,000 hectares of mangrove ecosystem along Madagascar's northwest coast near Mahajanga. Mangroves here protect coral reefs, provide nursery habitat for commercially important fish species, and shield coastal villages from cyclones. The project trains 500+ local fishers in sustainable aquaculture as alternative livelihoods.",
    attributes: { arr: "10.5%", irr: "13.2%", nftSymbol: "MMBC", sharePerNFT: 1, propertyType: "Mangrove Restoration", carbonCredits: 11000, initialSharePrice: 9, initialPropertyValue: 99000 },
    value_parameters: [{ roi: 13.2, rentalYield: 0, appreciation: 8.9 }, { roi: 11.8, rentalYield: 0, appreciation: 7.6 }],
    progress: [{ id: "1", title: "Coastal Survey", isDone: true }, { id: "2", title: "Nursery Setup", isDone: true }, { id: "3", title: "Phase 1 Planting", isDone: false }, { id: "4", title: "Plan Vivo Certification", isDone: false }],
    Highlights: [{ title: "15,000 Hectares", description: "Northwest coast mangrove restoration" }, { title: "Cyclone Protection", description: "Natural barrier for coastal villages" }, { title: "500+ Fishers Trained", description: "Sustainable aquaculture programs" }, { title: "Coral Reef Protection", description: "Reducing sediment runoff to reefs" }],
    Documents: ["Plan Vivo PDD", "Coastal Baseline Study", "Fisheries Impact Report"],
  },
  {
    name: "Costa Rica Cloud Forest Reserve",
    status: "trading",
    price: 16,
    available_shares: 8000,
    totalShares: 8000,
    location: "Monteverde, Costa Rica",
    type: "Forest Conservation",
    image: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800",
    growth: "+9.3%",
    weight: 2,
    description: "Protecting 25,000 hectares of montane cloud forest in the Monteverde region, home to the resplendent quetzal and 400+ bird species. Cloud forests capture moisture directly from clouds, feeding rivers that supply water to 50,000 people downstream. The project funds a biological research station and eco-tourism trails managed by local cooperatives.",
    attributes: { arr: "11.2%", irr: "14.0%", nftSymbol: "CRCF", sharePerNFT: 1, propertyType: "Cloud Forest", carbonCredits: 8000, initialSharePrice: 16, initialPropertyValue: 128000 },
    value_parameters: [{ roi: 14.0, rentalYield: 0, appreciation: 9.3 }, { roi: 12.5, rentalYield: 0, appreciation: 8.1 }],
    progress: [{ id: "1", title: "Reserve Established", isDone: true }, { id: "2", title: "Research Station Built", isDone: true }, { id: "3", title: "Eco-Tourism Trails", isDone: true }, { id: "4", title: "Buffer Zone Expansion", isDone: false }],
    Highlights: [{ title: "25,000 Hectares", description: "Pristine montane cloud forest" }, { title: "400+ Bird Species", description: "Including the resplendent quetzal" }, { title: "Water Security", description: "Cloud moisture for 50,000 people downstream" }, { title: "Research Station", description: "Active biological research programs" }],
    Documents: ["Gold Standard Certificate", "Biodiversity Inventory", "Water Impact Study"],
  },
  {
    name: "Vietnam Biochar Cookstove Program",
    status: "trading",
    price: 7,
    available_shares: 14000,
    totalShares: 14000,
    location: "Hanoi, Vietnam",
    type: "Clean Technology",
    image: "https://images.unsplash.com/photo-1504197832061-98356e3dcdcf?w=800",
    growth: "+6.5%",
    weight: 1,
    description: "Distributing 50,000 efficient biochar-producing cookstoves across rural Vietnam, replacing traditional three-stone fires. Each stove reduces fuel use by 60%, cuts indoor air pollution by 80%, and produces biochar that enriches soil fertility. The program has already improved respiratory health outcomes for 200,000+ people and reduced annual black carbon emissions significantly.",
    attributes: { arr: "8.2%", irr: "10.5%", nftSymbol: "VBC", sharePerNFT: 1, propertyType: "Improved Cookstoves", carbonCredits: 14000, initialSharePrice: 7, initialPropertyValue: 98000 },
    value_parameters: [{ roi: 10.5, rentalYield: 0, appreciation: 6.5 }, { roi: 9.2, rentalYield: 0, appreciation: 5.8 }],
    progress: [{ id: "1", title: "Stove Design Finalized", isDone: true }, { id: "2", title: "25,000 Distributed", isDone: true }, { id: "3", title: "50,000 Target", isDone: false }, { id: "4", title: "Impact Verification", isDone: false }],
    Highlights: [{ title: "50,000 Stoves", description: "Biochar-producing efficient cookstoves" }, { title: "60% Fuel Reduction", description: "Less wood consumption per household" }, { title: "200,000+ People", description: "Improved respiratory health outcomes" }, { title: "Soil Enhancement", description: "Biochar byproduct enriches farmland" }],
    Documents: ["Gold Standard Certificate", "Health Impact Study", "Distribution Records"],
  },
];

async function main() {
  console.log("=== Adding 7 New Projects + Deploying Tokens ===\n");

  for (const project of newProjects) {
    console.log(`--- ${project.name} ---`);

    // Insert into DB
    const { data: dbData, error: dbError } = await supabase
      .from("property_data")
      .insert([project])
      .select()
      .single();

    if (dbError || !dbData) {
      console.log("  DB insert failed:", dbError?.message);
      continue;
    }
    console.log("  Inserted, id:", dbData.id);

    // Deploy token via factory
    const symbol = project.attributes.nftSymbol;
    const maxSupply = ethers.parseEther(project.totalShares.toString());
    console.log(`  Deploying token: ${symbol}, maxSupply=${project.totalShares}...`);

    const tx = await factory.createToken(dbData.id, project.name, symbol, maxSupply);
    console.log("  tx:", tx.hash);
    await tx.wait();

    const tokenAddr = await factory.getToken(dbData.id);
    console.log("  Token:", tokenAddr);

    // Update DB with token address
    await supabase.from("property_data").update({ token_address: tokenAddr }).eq("id", dbData.id);

    // Set manager
    const pt = new ethers.Contract(tokenAddr, PT_ABI, wallet);
    const setMgrTx = await pt.setManager(CONFIG.creditManagerAddress);
    await setMgrTx.wait();
    console.log("  Manager set");

    // Register on CreditManager
    const regTx = await manager.registerProject(dbData.id);
    await regTx.wait();
    console.log("  Registered on CreditManager\n");
  }

  console.log("=== Done! Total projects: ===");
  const { data: all } = await supabase.from("property_data").select("name, token_address, location, totalShares");
  for (const p of (all ?? [])) {
    console.log(`  ${p.name} | ${p.location} | ${p.totalShares} shares | token=${(p.token_address || "none").substring(0, 20)}...`);
  }
}

main().catch(console.error);
