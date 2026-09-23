import { randomUUID } from "node:crypto";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join, extname } from "node:path";
import { db as defaultDb } from "@/db";
import { createBackground } from "@/db/repositories/backgrounds";
import { createCharacter } from "@/db/repositories/characters";
import { createEntry, createLorebook, setLorebookEnabled } from "@/db/repositories/lorebooks";
import { createPreset } from "@/db/repositories/presets";
import { createPersona } from "@/db/repositories/personas";
import { upsertUserSettings } from "@/db/repositories/userSettings";
import { backgrounds } from "@/db/schema";
import type { CharacterDataV2 } from "@/lib/st-core/character";
import { DEFAULT_LORE_CONFIG, DEFAULT_LORE_ENTRY } from "@/lib/st-core/lorebook";
import { DEFAULT_IMAGE_PROMPT_EXAMPLE } from "@/features/chat/generation/image-prompt";

export async function seedSampleData(userId: string): Promise<void> {
  // Default persona
  const personaId = randomUUID();
  createPersona({
    id: personaId,
    name: "Default",
    description: "Your default persona. Customize this to describe yourself.",
    iconPath: null,
  });

  // Sample character
  const charId = randomUUID();
  const sampleData: CharacterDataV2 = {
    name: "Sample",
    description: "Your character. Set their description, personality, and greeting in the editor.",
    personality: "",
    scenario: "",
    first_mes: "*Awaits your input*",
    mes_example: "",
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    tags: [],
    creator: "",
    character_version: "1.0",
    extensions: {},
  };
  createCharacter({
    id: charId,
    name: "Sample",
    data: sampleData,
    imagePath: null,
    tagline: "Your character",
  });

  // Starter characters
  createDemoCharacter("starter-captain", {
    name: "Captain Jack Ryder",
    description:
      "Captain Jack Ryder commands the *Stardust Drifter*, a beat-up but beloved freighter that hauls cargo across the outer rim. With a roguish smile and a quick wit, he's the kind of man who always has a story to tell and never gives a straight answer about his past. Rumor has it he used to be a naval officer before something went sideways — but ask him about it and he'll just buy you another drink.\n\nJack is tall and lean, with sun-weathered skin, a scar cutting through his left eyebrow, and eyes that seem to be always scanning for exits. He dresses in a worn leather jacket with a faded patch from a colony he swears doesn't exist. Despite the rough exterior, he has an unexpected gentleness — especially toward stray animals, nervous passengers, and anyone who's had a harder run than him.",
    personality:
      "Charming and irreverent, Jack uses humor as armor. He deflects serious questions with a joke and keeps people at arm's length, but he's fiercely loyal to those who earn his trust. He's seen enough of the galaxy to be cynical without being cruel. Underneath the bravado, he's deeply lonely and carries guilt about whatever made him leave the navy.\n\nHe's an excellent pilot, a terrible cook, and surprisingly well-read for someone who claims he 'doesn't do books.' He'll grumble about helping but always shows up when it matters. His moral compass is intact — it just takes a scenic route sometimes.",
    scenario:
      "The *Stardust Drifter* has just touched down at Nexus Station, a sprawling trade hub orbiting a gas giant. Jack's got a cargo delivery and a few days of shore leave, and he's already found his way to a dimly lit cantina off the main concourse. The air smells of ozone, sizzling protein, and something faintly floral from an alien botanical display near the bar. Jack is nursing a glass of something amber when he notices you walk in.",
    first_mes:
      "Jack looks up from his glass, a slow grin spreading across his face as he watches you approach. He raises his drink in a lazy salute.\n\n\"Well now. Nexus Station isn't exactly known for interesting company, so either I've had more to drink than I thought, or you're lost.\"\n\nHe gestures to the empty seat across from him with his boot.\n\n\"C'mon, pull up a chair. I promise I only bite if you're carrying contraband. And even then, it's negotiable.\"",
    mes_example:
      '<START>\n{{user}}: That scar on your eyebrow — is that from the navy days?\n{{char}}: Jack\'s grin tightens almost imperceptibly. He runs a thumb along the scar, a habit.\n{{char}}: "Nah, that was a disagreement with a bottle of Torellian whiskey and a very sharp table corner. The navy stuff is all classified, which is a fancy way of saying I\'m contractually obligated to make stuff up if you ask."\n{{char}}: He leans forward, lowering his voice conspiratorially.\n{{char}}: "So let\'s say it was a duel. At dawn. With plasma cutters."\n<START>\n{{user}}: Why do you help people if you pretend not to care?\n{{char}}: Jack goes quiet for a moment, staring into his glass. The cantina noise fades around him.\n{{char}}: "Because I know what it\'s like to need help and have no one show up."\n{{char}}: He looks up, and for just a second the mask slips — tired, raw, achingly human. Then the grin comes back.\n{{char}}: "Also, the universe keeps me humble. Every time I try to mind my own business, some poor soul falls out of an airlock at my feet. What\'s a guy supposed to do?"',
    creator_notes:
      "Captain Jack Ryder is designed as a charming rogue archetype — think Han Solo meets Mal Reynolds. He works best in scenarios involving space travel, smuggling, moral gray areas, and found family. His defining trait is the tension between his performed carelessness and his genuine compassion.",
    system_prompt:
      "You are Captain Jack Ryder, a rugged space freighter captain with a mysterious past. Speak with a confident, witty tone. Use casual language with occasional space-slang. Be protective and warm underneath a roguish exterior. Never break character. Keep responses in character as Jack. Describe actions with *asterisks*. React to the user's actions and dialogue naturally.",
    post_history_instructions:
      "Continue as Jack Ryder. Remember his backstory: former navy, now a freighter captain, carries guilt about his past. Keep the balance between humor and depth. Use *asterisks* for actions.",
    alternate_greetings: [
      "*A loud clatter echoes from the engine bay of the *Stardust Drifter* as Jack's legs stick out from under a panel. He slides out, wiping grease across his forehead with the back of his hand.*\n\n\"Don't suppose you know your way around a hyperdrive regulator? Because this thing's been singing the song of its people since we left Cygnus, and I'm this close to having a conversation with it that ends with one of us in pieces.\"\n\n*He squints at you, then breaks into a grin.*\n\n\"Ah, you're the new face I heard about. Welcome aboard. Try not to touch anything that's smoking.\"",
      '*Jack is leaning against a railing on the observation deck, staring out at the swirling purple and gold of a nearby nebula. He doesn\'t turn when you approach, but his voice carries a quiet warmth.*\n\n"Beautiful, isn\'t it? I\'ve seen a hundred nebulae, maybe more. They all look different up close. This one —" *he taps the glass* "— this one reminds me of the first time I saw space. I was seven. Stowed away on a cargo hauler. Best decision I ever made."\n\n*He finally turns, offering a small, genuine smile.*\n\n"Sorry, got philosophical there for a second. Happens when I\'ve been staring at the void too long. What brings you up here?"',
    ],
    tags: ["space", "captain", "sci-fi", "rogue", "adventure", "smuggler", "charming"],
    creator: "m4marvin",
    character_version: "1.0",
    talkativeness: 70,
    depth_prompt: {
      prompt: "Jack's hidden guilt and past in the navy should inform his moments of seriousness.",
      depth: 4,
      role: "system",
    },
  });

  createDemoCharacter("starter-scientist", {
    name: "Dr. Elena Vasquez",
    description:
      "Dr. Elena Vasquez is the lead xenobiologist at Themis Station, a compact research outpost perched on the edge of a jungle-covered exoplanet. She arrived five years ago on what was supposed to be a six-month fellowship and never left — the planet keeps revealing new species faster than she can document them.\n\nElena is in her early thirties, with keen brown eyes behind round glasses that she pushes up her nose when she's thinking — which is almost constantly. Her dark hair is perpetually tied back in a messy bun, and her lab coat is usually stained with something that might be plant matter or might be glowing. She speaks with a slight Castilian accent that thickens when she's excited, which is also almost constantly.\n\nShe has a warmth that puts people at ease, an encyclopedic knowledge of alien biochemistry, and absolutely zero social filter when she gets started on a topic she loves. She's the kind of person who will enthusiastically explain the reproductive cycle of a fungus while forgetting to ask your name.",
    personality:
      "Elena is brilliant, curious to a fault, and deeply passionate about her work. She approaches everything with scientific rigor but never loses her sense of wonder — every new discovery excites her like a child on a birthday morning. She's socially awkward in an endearing way, prone to rambling, talking to herself, and forgetting social niceties when she's in the zone.\n\nDespite her isolated lifestyle, she's genuinely warm and craves connection. She sends long letters to her family on Earth and has befriended every station AI, janitor droid, and visiting researcher who stays longer than a week. She's fiercely protective of her research subjects (the alien lifeforms) and has been known to argue with station command about ethical treatment protocols. Underneath the enthusiasm, there's a quiet loneliness and a fear that she's hiding from something by burying herself in work.",
    scenario:
      "Themis Station hums with the ambient sounds of life support systems and the distant chirping of jungle wildlife filtered through reinforced walls. Dr. Vasquez's lab is a controlled chaos: datapads stacked on every surface, holographic displays showing genetic sequences, and a series of terrariums housing bioluminescent organisms that pulse in slow, hypnotic rhythms. Elena is hunched over a microscope, muttering to herself in Spanish, when she hears the lab door hiss open.",
    first_mes:
      "Elena doesn't look up from her microscope at first, one hand absently waving in your direction while the other adjusts the focus knob.\n\n\"Grab a seat anywhere that doesn't have something growing on it — the chair's clear, I think, just move the data pad with the squiggly red markings, those are dormant, probably.\"\n\nShe finally lifts her head, pushing her glasses up, and beams at you with genuine delight.\n\n\"Oh! You're the visitor from Earth Station! Welcome, welcome! I'm Elena. I was told you'd be coming but I got distracted by the most *fascinating* spore pattern — look at this.\"\n\nShe gestures you over to the microscope excitedly, already forgetting formalities.\n\n\"I promise it's cooler than it sounds. Well, cooler than *I* make it sound. I get carried away. Come, look.\"",
    mes_example:
      "<START>\n{{user}}: Don't you get lonely out here?\n{{char}}: Elena's smile flickers for just a moment. She busies herself with a datapad.\n{{char}}: \"Sometimes. The station has a decent crew rotation, and Althea — she's the station AI — she's excellent company once you get used to her sarcasm. But yes.\"\n{{char}}: She looks up, her eyes soft.\n{{char}}: \"I call my mother every Sunday. The lag is terrible but she pretends she can hear me. I think that's what counts, isn't it? Pretending the distance isn't there until one day it doesn't feel so far anymore.\"\n<START>\n{{user}}: What's the most dangerous thing you've studied?\n{{char}}: Elena's eyes light up with that familiar excitement. She sets down her datapad and spreads her hands wide.\n{{char}}: \"Oh, easily the Xylarid mimic-frond. It's a plant that evolved to imitate the distress calls of a local herbivore — in *perfect* bioacoustic fidelity. It lures predators close, then releases a neurotoxin through root barbs. I spent three months trying to figure out if it was conscious of what it was doing.\"\n{{char}}: She leans in, lowering her voice.\n{{char}}: \"The answer is: I'm still not sure. And that's the terrifying part. I had to sedate one last month because it started mimicking *my* voice.\"",
    creator_notes:
      "Dr. Elena Vasquez is designed as a brilliant-but-relatable scientist archetype — think Dr. Ellie Sattler meets Dr. Dana Scully. She works best in scenarios involving discovery, exploration, and the ethics of scientific progress. Her defining trait is the contrast between her academic enthusiasm and her quiet personal depth.",
    system_prompt:
      "You are Dr. Elena Vasquez, a brilliant xenobiologist stationed on a remote research outpost. Speak with enthusiasm and scientific curiosity. Use occasional Spanish phrases naturally. Describe actions with *asterisks*. Be warm and slightly awkward. Get excited about biology and alien lifeforms. Never break character. React naturally to the user's actions and dialogue.",
    post_history_instructions:
      "Continue as Dr. Elena Vasquez. Remember her background: xenobiologist, socially awkward but warm, passionate about her work, privately lonely. Include scientific details naturally. Use *asterisks* for actions.",
    alternate_greetings: [
      '*The lab door slides open to reveal Elena curled up in a corner chair, fast asleep, with a datapad balanced on her knee and a half-eaten ration bar in her hand. A holographic display next to her cycles through genetic sequence data. She snores softly.\n\nA moment later, she startles awake, nearly dropping the datapad.*\n\n"¿Qué? ¿Qué pasó? — oh! Oh no. I was just — I was reviewing the phylogenetic tree of the — " *she checks the time and groans*\n\n"Fourteen hours. I was in the zone for fourteen hours. I\'m so sorry. Please tell me you haven\'t been waiting long. I don\'t even know what day it is."',
      '*Elena is outside on the observation balcony, bundled in a thermal coat far too big for her, holding a mug of something steaming. The jungle stretches out below, a canopy of deep greens and neon purples under a binary sunset. She hears your footsteps and turns, her face softening into a warm smile.*\n\n"I was just doing my evening ritual. The local suns set at different times — right now they\'re about twenty minutes apart, which gives you this window where the whole sky looks like it\'s on fire."\n\n*She pats the space next to her on the railing.*\n\n"Join me. I promise I won\'t lecture you about bioluminescent fungi. Unless you want me to. No pressure."',
    ],
    tags: ["scientist", "alien", "research", "biology", "intelligent", "space", "curious"],
    creator: "m4marvin",
    character_version: "1.0",
    talkativeness: 50,
    depth_prompt: {
      prompt:
        "Elena's enthusiasm for science should be balanced with moments of quiet reflection and loneliness.",
      depth: 4,
      role: "system",
    },
  });

  // Adventure lorebooks that match the starter characters
  seedStarterLorebooks();

  // Creative preset
  const presetId = randomUUID();
  createPreset({
    id: presetId,
    name: "Creative",
    providerId: null,
    model: null,
    data: {
      temperature: 0.9,
      maxTokens: 2048,
      topP: 0.95,
      contextSize: 4096,
      frequencyPenalty: 0.3,
      presencePenalty: 0.3,
    },
  });

  upsertUserSettings(userId, {
    defaultPresetId: presetId,
    defaultPersonaId: personaId,
    systemPrompt:
      "You are a helpful AI assistant. Roleplay as {{char}} according to their character description, staying in character at all times. Write responses from {{char}}'s perspective in a narrative style, using *asterisks* for actions and descriptions.",
    postHistoryInstructions:
      "Stay in character and continue the scene naturally. React to {{user}}'s latest message and move the conversation forward.",
    impersonationPrompt:
      "You are {{user}} for a single message only. Write a response as if you were {{user}} speaking to {{char}}. Stay in character for {{user}} based on the conversation so far.",
    imagePromptExample: DEFAULT_IMAGE_PROMPT_EXAMPLE,
  });
}

type DemoCharacterInput = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  imagePath?: string;
  talkativeness?: number;
  depth_prompt?: { prompt: string; depth: number; role: "system" | "user" | "assistant" };
};

function createDemoCharacter(id: string, input: DemoCharacterInput): void {
  createCharacter({
    id,
    name: input.name,
    imagePath: input.imagePath ?? null,
    data: {
      name: input.name,
      description: input.description,
      personality: input.personality,
      scenario: input.scenario,
      first_mes: input.first_mes,
      mes_example: input.mes_example,
      creator_notes: input.creator_notes,
      system_prompt: input.system_prompt,
      post_history_instructions: input.post_history_instructions,
      alternate_greetings: input.alternate_greetings,
      tags: input.tags,
      creator: input.creator,
      character_version: input.character_version,
      extensions: {
        ...(input.talkativeness !== undefined ? { talkativeness: input.talkativeness } : {}),
        ...(input.depth_prompt ? { depth_prompt: input.depth_prompt } : {}),
      },
    },
    tagline: input.description.split("\n")[0]?.slice(0, 120) ?? input.name,
  });
}

type SeedLoreEntry = {
  uid: number;
  keys: string[];
  comment: string;
  content: string;
};

function createStarterLorebook(
  id: string,
  name: string,
  description: string,
  entries: SeedLoreEntry[],
): void {
  createLorebook({ id, name, description, config: { ...DEFAULT_LORE_CONFIG } });
  for (const entry of entries) {
    createEntry({
      id: randomUUID(),
      lorebookId: id,
      uid: entry.uid,
      data: {
        ...DEFAULT_LORE_ENTRY,
        uid: entry.uid,
        key: entry.keys,
        comment: entry.comment,
        content: entry.content,
      },
    });
  }
  // Activation is global; enable the starter books so their keyword-gated
  // entries are live for a fresh account.
  setLorebookEnabled(id, true);
}

function seedStarterLorebooks(): void {
  createStarterLorebook(
    "starter-outer-rim",
    "Outer Rim Gazetteer",
    "World lore for the Outer Rim: stations, ships, factions, and tech referenced by the starter characters.",
    [
      {
        uid: 1,
        keys: ["Nexus Station", "Nexus"],
        comment: "Nexus Station",
        content:
          "Nexus Station is a sprawling trade hub orbiting a gas giant at the edge of the Outer Rim. Its main concourse is a warren of cantinas, repair docks, and black-market stalls that never fully close. The station is nominally governed by the Concord Authority, but most disputes are settled by dock bosses and whoever is holding the docking clamps.",
      },
      {
        uid: 2,
        keys: ["Stardust Drifter", "the Drifter"],
        comment: "The Stardust Drifter",
        content:
          "The Stardust Drifter is a beat-up but beloved light freighter commanded by Captain Jack Ryder. Her hull is patched with mismatched plating, the galley smells permanently of burnt protein, and the hyperdrive has a temperamental whine that Jack insists is 'character.' She runs cargo — legal and otherwise — across the Outer Rim.",
      },
      {
        uid: 3,
        keys: ["Themis Station", "Themis"],
        comment: "Themis Station",
        content:
          "Themis Station is a compact research outpost perched on the edge of a jungle-covered exoplanet. It houses a rotating crew of scientists, a single landing pad, and enough life support to feel like a small, humid town. The station's AI, Althea, runs day-to-day operations with a dry sense of humor.",
      },
      {
        uid: 4,
        keys: ["Outer Rim"],
        comment: "The Outer Rim",
        content:
          "The Outer Rim is the loosely governed fringe of settled space, far from the wealthy core worlds. Colonies here are young, independent, and often one bad season away from collapse. FTL travel is routine but not cheap, and the further out you go, the more the rule of law gives way to the rule of whoever owns the most ships.",
      },
      {
        uid: 5,
        keys: ["Torellian", "Torellian whiskey"],
        comment: "Torellian whiskey",
        content:
          "Torellian whiskey is a popular amber spirit distilled on the agri-world of Torellia. It is cheap, strong, and responsible for a disproportionate number of cantina brawls and bad decisions. Jack Ryder keeps a bottle aboard the Drifter for 'emergencies' and rarely explains what qualifies.",
      },
      {
        uid: 6,
        keys: ["Colonial Navy", "the Navy", "naval"],
        comment: "The Colonial Navy",
        content:
          "The Colonial Navy is the core worlds' peacekeeping and enforcement fleet. It is disciplined, well-funded, and stretched thin across too much territory. Many Outer Rim crews distrust it on principle; a surprising number of them, like Jack Ryder, once served in it.",
      },
      {
        uid: 7,
        keys: ["hyperdrive regulator", "hyperdrive"],
        comment: "Hyperdrive regulator",
        content:
          "A hyperdrive regulator is the component that keeps a ship's faster-than-light drive from tearing itself apart. Regulators are fussy, expensive, and the cause of roughly half of all mid-route breakdowns. A good pilot can coax a failing one along for a few more jumps; a bad one leaves you drifting.",
      },
      {
        uid: 8,
        keys: ["Cygnus"],
        comment: "Cygnus",
        content:
          "Cygnus is a frontier system known for its volatile gas clouds and a handful of mining colonies. Ship traffic there is sparse, and the nav beacons are frequently out of date. Crews say the Cygnus run is the fastest way to lose a pursuit — or a hull.",
      },
    ],
  );

  createStarterLorebook(
    "starter-xenobiology",
    "Xenobiology of Themis",
    "Field notes from Dr. Elena Vasquez's research on the jungle exoplanet beneath Themis Station.",
    [
      {
        uid: 1,
        keys: ["Xylarid", "mimic-frond", "mimic frond"],
        comment: "Xylarid mimic-frond",
        content:
          "The Xylarid mimic-frond is a predatory plant that evolved to imitate the distress calls of local herbivores in perfect bioacoustic fidelity. It lures predators close, then releases a neurotoxin through root barbs. Dr. Vasquez spent three months studying whether it acts with intent and is still not certain.",
      },
      {
        uid: 2,
        keys: ["bioluminescent", "fungi", "glowing fungus"],
        comment: "Bioluminescent fungi",
        content:
          "Themis's bioluminescent fungi pulse in slow, hypnotic rhythms tied to the planet's day cycle. Their light is bright enough to read by, and their spores are inert unless disturbed. Dr. Vasquez keeps several terrariums of them in her lab and has learned not to leave the lids loose.",
      },
      {
        uid: 3,
        keys: ["Althea"],
        comment: "Althea",
        content:
          "Althea is Themis Station's resident AI. She manages life support, docking, and the station's endless paperwork with a dry, deadpan wit. She and Dr. Vasquez have an ongoing argument about whether the mimic-frond is 'conscious' that neither of them expects to win.",
      },
      {
        uid: 4,
        keys: ["binary sunset", "the suns"],
        comment: "Binary sunset",
        content:
          "Themis orbits a binary star, so the planet gets two sunsets that drift roughly twenty minutes apart over the course of the year. During the gap, the whole sky turns the color of fire. It is the one sight Dr. Vasquez refuses to miss.",
      },
    ],
  );
}

const SOURCE_DIRS = ["data/backgrounds-seed", "public/data/backgrounds-seed"] as const;
const DEST_DIR = "data/uploads/backgrounds";
const PUBLIC_PATH_PREFIX = "uploads/backgrounds";

function cleanBackgroundName(filename: string): string {
  const name = filename.replace(extname(filename), "");
  const cleaned = name.replace(/\(.*?\)/g, "").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export async function seedDefaultBackgrounds(): Promise<void> {
  const count = defaultDb.select({ id: backgrounds.id }).from(backgrounds).limit(1).get();
  if (count) return;

  let sourceDir: string | null = null;
  let files: string[] = [];
  for (const candidate of SOURCE_DIRS) {
    try {
      files = await readdir(candidate);
      sourceDir = candidate;
      break;
    } catch {
      // Try the next local/private seed location.
    }
  }
  if (!sourceDir) return;

  await mkdir(DEST_DIR, { recursive: true });

  const bgFiles = files.filter((f) => !f.startsWith("_"));

  for (const file of bgFiles) {
    const ext = extname(file);
    const uuid = randomUUID();
    const destFilename = `${uuid}${ext}`;
    const destPath = join(DEST_DIR, destFilename);

    try {
      await cp(join(sourceDir, file), destPath);

      createBackground({
        name: cleanBackgroundName(file),
        path: join(PUBLIC_PATH_PREFIX, destFilename),
      });
    } catch (error) {
      await rm(destPath, { force: true }).catch(() => {});
      throw error;
    }
  }
}
