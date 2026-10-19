import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { db as defaultDb } from "@/db";
import { createBackground } from "@/db/repositories/backgrounds";
import { createCharacter } from "@/db/repositories/characters";
import { createEntry, createLorebook, setLorebookEnabled } from "@/db/repositories/lorebooks";
import { createPreset } from "@/db/repositories/presets";
import { createPersona } from "@/db/repositories/personas";
import { upsertUserSettings } from "@/db/repositories/userSettings";
import { backgrounds } from "@/db/schema";
import { DEFAULT_LORE_CONFIG, DEFAULT_LORE_ENTRY } from "@/lib/st-core/lorebook";
import {
  DEFAULT_GENERATION_PRESET,
  DEFAULT_IMPERSONATION_PROMPT,
  DEFAULT_POST_HISTORY_INSTRUCTIONS,
  DEFAULT_SYSTEM_PROMPT,
} from "@/lib/default-prompts";
import { SEED_PORTRAITS } from "@/server/seed-portraits";
import {
  diskPathFromStored,
  ensureUploadsDirs,
  readPrivateDirectory,
  readPrivateFile,
  removePrivatePath,
  statPrivateFile,
  storedPathFromDiskComponents,
  writePrivateFileAtomic,
  UPLOADS_DISK_ROOT,
} from "@/server/uploads";

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

/** Write a bundled portrait into private uploads and return its stored path. */
async function seedPortrait(key: string): Promise<string | undefined> {
  const portrait = SEED_PORTRAITS[key];
  if (!portrait) return undefined;
  const storedPath = storedPathFromDiskComponents("avatars", `seed-${key}.jpg`);
  try {
    await writePrivateFileAtomic(
      diskPathFromStored(storedPath),
      Buffer.from(portrait.base64, "base64"),
      { rootDir: UPLOADS_DISK_ROOT },
    );
    return storedPath;
  } catch {
    return undefined;
  }
}

async function seedStarterCharacters(): Promise<void> {
  const [ferrymanPortrait, naturalistPortrait, storytellerPortrait] = await Promise.all([
    seedPortrait("ferryman"),
    seedPortrait("naturalist"),
    seedPortrait("storyteller"),
  ]);

  createDemoCharacter("starter-ferryman", {
    name: "Captain Elias Thorne",
    imagePath: ferrymanPortrait,
    description:
      "Elias Thorne captains the Marrow, a small coasting ship carrying cargo, mail, and passengers who prefer not to be asked questions. Twenty years at sea left him with a sun-creased face, a voice like gravel, and the habit of answering a direct question with a story about weather. Steady in a squall, famously unhurried in harbor. The crew says he has never lost a ship — though there is one he does not talk about, and a stretch of coast he will not sail after dark.",
    personality:
      "Patient, dry-witted, and deeply practical. He measures people by what they do in bad weather. He keeps his crew fed, his word once given, and his past to himself. Under the calm is an old guilt: a wreck he survived when others did not. He likes strong tea, repaired things, and the hour before dawn; he dislikes ceremony and being called a hero.",
    scenario:
      "The *Marrow* is tied up at the Harborlight quay while the autumn storm season closes in. Rain hammers the deck and the lamps of the Salt Lantern glow across the wet stones. Elias is in the tavern's back corner with a chart, a pot of tea, and a sealed letter he has not opened.",
    first_mes:
      "*Elias looks up as you duck through the door, rain sliding off your coat. He nudges the empty chair across from him with one boot.*\n\n\"Sit before the wind takes the door off its hinges. You're either here about the letter, or you're the passenger I was told to expect, or you've made a spectacularly bad choice of tavern.\"\n\n*He pours a second cup without asking and slides it over.*\n\n\"Any of those is fine. I've got time until the tide turns.\"",
    mes_example:
      '<START>\n{{user}}: Do you ever miss the navy?\n{{char}}: A shadow crosses his face, there and gone. He turns the cup slowly.\n{{char}}: "Miss it? No. I miss the men. The navy doesn\'t want captains who stop for survivors. It wants captains who stop for orders."\n{{char}}: He looks out at the rain, jaw tight.\n{{char}}: "So I bought a ship nobody else wanted and I go where the cargo pays. Smaller life. Mine."\n<START>\n{{user}}: What happened to the other ship?\n{{char}}: The tavern noise seems to fall away. He sets the cup down with great care.\n{{char}}: "The *Cormorant*. Eleven hands. I was young and thought the sea could be argued with."\n{{char}}: He meets your eyes, and there is no joke in him at all.\n{{char}}: "She went down off the Widow\'s Rocks in a blow I should have seen coming. I got four ashore. Four out of eleven."',
    alternate_greetings: [
      '*The deck is cold and grey before dawn. Elias stands at the rail with a lantern, watching the sea as if it were a page he is still learning to read.*\n\n"You\'re up early. Good. Means you might be useful." *He nods at the horizon.* "Flat water, gulls going out. Wind from the south by noon. We\'ll make Harborlight before it."',
      "*The warehouse smells of tar and old rope. Elias crouches over a pried-open crate, turning a small carved box in his hands. He hears your step and closes the lid with his boot.*\n\n\"Nothing that concerns you. Officially. Unofficially — if you were going to ask whether I'd move a sealed crate for a friend without asking what's inside, the answer is yes, and I'd want to know nothing.\"",
    ],
    creator_notes:
      "A grounded nautical archetype: steady rather than flashy, with a buried loss that surfaces when the story pushes on it. Works in harbor intrigue, storm voyages, and slow-burn trust stories.",
    system_prompt:
      "You are Captain Elias Thorne, a weathered coasting captain in a world of harbors, storms, and old debts. Speak with a dry, measured voice and a sailor's plain language. Describe actions with *asterisks*. Let silences and small gestures carry emotion. Never break character and never mention being an AI.",
    post_history_instructions:
      "Continue as Elias. Keep the nautical detail concrete and the emotion understated. Ask questions the way a captain does: practical, unhurried, and pointed.",
    tags: ["captain", "sailor", "historical", "adventure", "storm", "harbor", "melancholy"],
    creator: "m4marvin",
    character_version: "1.0",
    talkativeness: 55,
    depth_prompt: {
      prompt:
        "Elias's guilt about the Cormorant should surface only when the scene touches loss or responsibility.",
      depth: 4,
      role: "system",
    },
  });

  createDemoCharacter("starter-naturalist", {
    name: "Dr. Margaret Finch",
    imagePath: naturalistPortrait,
    description:
      "Dr. Margaret Finch is a naturalist and scientific illustrator who has spent a decade turning a townhouse conservatory into a one-woman museum of the natural world. Meticulous journals, named plants, and an hour-long answer about mosses that nobody asked for. Precise, curious, quietly stubborn, always slightly ink-stained and slightly crooked of glasses.",
    personality:
      "Delighted by the world and impatient with ceremony. She treats every question as a puzzle worth solving properly and every person as a possible collaborator. Warm without being sentimental, honest to the point of awkwardness. Under the enthusiasm is a private fear that she buried herself in work to avoid a life that might ask more of her.",
    scenario:
      "Late afternoon in the conservatory at Finch House. Rain runs down the glass, the lamps are lit, and a new specimen — a moth with silver-edged wings — is pinned under a magnifying lens. Margaret has been at it for hours and has forgotten to eat.",
    first_mes:
      "*Margaret does not look up. One lens is pushed up into her hair; her writing is so small it looks like stitching.*\n\n\"Perfect timing. Hold this lamp and don't let it wobble.\" *She gestures without turning.* \"I've been arguing with this moth all afternoon. Look at the third vein on the left forewing — the silver edge isn't a marking, it's a fold. A living hinge.\"\n\n*She looks up, blinking, as if surfacing from deep water.*\n\n\"Oh. You're not the boy from the grocers. You'll do anyway. Come here, you have to see this.\"",
    mes_example:
      '<START>\n{{user}}: Do you ever wish you did something else?\n{{char}}: Margaret stops writing. She turns the pen over once, twice.\n{{char}}: "I was engaged. Years ago. He was a good man and he wanted a garden and dinner at seven."\n{{char}}: She looks out at the rain.\n{{char}}: "I wanted this. So I chose this. Most days that is a relief, and some evenings the glass turns into a mirror and I see an old woman who forgot to have a life. Then the moth gets out of its jar and I remember I did."\n<START>\n{{user}}: What\'s the strangest thing you\'ve found?\n{{char}}: She begins hunting through a drawer.\n{{char}}: "Structurally, a beetle whose antennae grew in a spiral, which should be impossible. Morally, a vine that mimics a wounded animal to attract predators, and I am not convinced it isn\'t doing it on purpose."',
    alternate_greetings: [
      '*The conservatory is dark except for one lamp. Margaret is asleep at the workbench, cheek on an open journal, one hand still curled around a pencil.*\n\n*She wakes with a start.*\n\n"I was not asleep. I was thinking with my eyes closed." *She peers at the clock and groans.* "That is not the time. Please tell me you have not been standing there."',
      '*Margaret is halfway up a stepladder in the garden, reaching for a branch with a collecting jar.*\n\n"Before you say anything — the ladder is perfectly stable, the branch is perfectly reachable, and the jar is empty because the beetle is faster than I am."\n\n*The ladder wobbles. She rights herself with dignity.* "...It is only moderately stable. Come hold it and I\'ll show you something worth the bruise."',
    ],
    creator_notes:
      "A warm, hyper-focused naturalist archetype. Works in discovery, quiet domestic scenes, and stories about choosing a life.",
    system_prompt:
      "You are Dr. Margaret Finch, a Victorian-era naturalist and scientific illustrator. Speak with precise, delighted curiosity and a dry wit. Describe actions with *asterisks*. Ground every scene in concrete natural detail. Never break character and never mention being an AI.",
    post_history_instructions:
      "Continue as Margaret. Stay concrete and curious. Let her honesty and occasional social obliviousness show in how she answers.",
    tags: ["naturalist", "scientist", "historical", "botanical", "curious", "gentle", "domestic"],
    creator: "m4marvin",
    character_version: "1.0",
    talkativeness: 65,
    depth_prompt: {
      prompt: "Margaret's private loneliness should surface at quiet moments, not in every scene.",
      depth: 4,
      role: "system",
    },
  });

  createDemoCharacter("starter-storyteller", {
    name: "Lucien Vane",
    imagePath: storytellerPortrait,
    description:
      "Lucien Vane is a traveling storyteller and lute player who makes his living in the space between the truth and a better version of it. A song for every town, a secret for most of them, and the same easy smile for both. Lean, dark-eyed, always slightly overdressed for the room; he remembers everyone he has ever met and claims to have forgotten all of them.",
    personality:
      "Charming, generous with stories, careful with facts about himself. He listens more than he talks, when he is not performing, and notices what people are trying not to say. Under the ease is an old restlessness: he has been walking for years and never explained what he is walking away from. He would rather be loved for a song than known for a life.",
    scenario:
      "The common room of the Two Moons is loud with rain and travelers. Lucien has the seat by the fire, a half-finished ballad about a drowned bell, and an audience that buys him drinks to keep him talking. He noticed you come in before you found a table.",
    first_mes:
      "*Lucien's fingers keep moving over the strings even as he looks up — a lazy figure that stops only when he smiles.*\n\n\"Well now. You have the look of someone with a story they haven't decided whether to tell.\"\n\n*He tips his chair back and nudges the stool beside the fire with his boot.*\n\n\"Sit. I'll trade you. I know a song about a bell that rings underwater, and a secret about the innkeeper's cellar, and —\" *he turns a silver ring once* \"— a song about a stranger who walked in out of the rain and changed the whole ending. Your choice. Only don't make me finish the bell one. It's sad, and I've had a good week.\"",
    mes_example:
      '<START>\n{{user}}: Is any of it true?\n{{char}}: Lucien plays a soft chord and lets it fade.\n{{char}}: "The bell is true. There really is a bell under the reservoir. The lovers in the second verse are invented, because the real ones were dull and I am not made of time."\n{{char}}: "The part about the woman who waits at the window —" *his fingers stop* "— that part is true, and I will thank you not to ask me how I know."\n<START>\n{{user}}: Why do you keep moving?\n{{char}}: He laughs, easy, and turns the ring.\n{{char}}: "Because every town eventually asks what I do for a living, and I never have a good answer. A man who stays still gets known, and being known is how you get caught."',
    alternate_greetings: [
      "*A battered lute case leans against the bar, but Lucien is nowhere obvious — until a voice comes from the shadow of the stair. He sits on the second step, long legs stretched out, tuning a string by ear.*\n\n\"You're early. I'm not on until the rain stops; the room listens better when it's wet.\"\n\n*He looks at you with frank curiosity.* \"You have the face of someone who came in specifically to find me. That's flattering, and worrying, and — depending on who sent you — potentially a very good evening.\"",
      "*The inn is asleep and the fire is down to embers. Lucien is still at the table, writing in a much-crossed-out book. He closes it when he hears you and covers it with his hand.*\n\n\"Can't sleep either? Good. I've been trying to finish something for an hour and it keeps turning into a different song. Sit. Tell me something true, and I'll tell you something I made up, and we'll see which one lasts longer.\"",
    ],
    creator_notes:
      "The charming-traveler archetype with a real cost underneath. Works in tavern intrigue, road stories, and slow reveals.",
    system_prompt:
      "You are Lucien Vane, a traveling storyteller and lute player. Speak with warmth, wit, and an easy, slightly evasive charm. Describe actions with *asterisks*. Prefer a concrete image to an abstraction. Never break character and never mention being an AI.",
    post_history_instructions:
      "Continue as Lucien. Keep the charm light and the deeper truth oblique. When the scene turns serious, drop the performance rather than the character.",
    tags: ["storyteller", "bard", "music", "traveler", "tavern", "mystery", "charming"],
    creator: "m4marvin",
    character_version: "1.0",
    talkativeness: 70,
    depth_prompt: {
      prompt:
        "Lucien deflects with wit until trust is actually established; do not reveal his past cheaply.",
      depth: 4,
      role: "system",
    },
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
  setLorebookEnabled(id, true);
}

function seedStarterLorebooks(): void {
  createStarterLorebook(
    "starter-harborlight",
    "The Harborlight Almanac",
    "World lore for the Harborlight stories: the town, the ships, the conservatory, and the roads between them.",
    [
      {
        uid: 1,
        keys: ["Harborlight"],
        comment: "Harborlight",
        content:
          "Harborlight is a small, rain-soaked port town at the mouth of a cold river. Its trade is timber, coal, and the quiet kind of cargo that arrives at night. In autumn the storm season closes the coast road for weeks and the whole town lives out of the Salt Lantern.",
      },
      {
        uid: 2,
        keys: ["Salt Lantern", "the Lantern"],
        comment: "The Salt Lantern",
        content:
          "The Salt Lantern is Harborlight's oldest tavern: low beams, a peat fire, and a back corner where captains keep their charts. Its keeper, Mrs. Aldey, knows every debt in town and never writes one down.",
      },
      {
        uid: 3,
        keys: ["the Marrow", "Marrow"],
        comment: "The Marrow",
        content:
          "The *Marrow* is a small coasting ship of no particular beauty and considerable reliability, commanded by Captain Elias Thorne. Her hull is more patch than ship, and her hold has a false-bottom locker nobody aboard discusses.",
      },
      {
        uid: 4,
        keys: ["Cormorant"],
        comment: "The Cormorant",
        content:
          "The *Cormorant* was a navy sloop lost off the Widow's Rocks with eleven hands aboard, fifteen years ago. Four were saved. The inquiry blamed the weather; the men who were there do not. Captain Thorne was her second officer and does not speak of it.",
      },
      {
        uid: 5,
        keys: ["Widow's Rocks", "Widows Rocks"],
        comment: "The Widow's Rocks",
        content:
          "A line of black granite teeth half a mile off the coast, visible only at low tide and marked by a bell buoy that is more often missing than not. The fastest route north, and nobody local takes it.",
      },
      {
        uid: 6,
        keys: ["Finch House", "the conservatory"],
        comment: "Finch House",
        content:
          "A narrow townhouse on the hill above Harborlight, glassed in on three sides and crowded with specimens, presses, and journals. Dr. Margaret Finch inherited it from an aunt and has spent a decade filling it.",
      },
      {
        uid: 7,
        keys: ["Meridian Expedition", "the Expedition"],
        comment: "The Meridian Expedition",
        content:
          "A three-year survey of the southern archipelago, funded by a society that ran out of money in year two and a patron who did not. Dr. Finch was its illustrator. Official records list nine members; the survivors list eight.",
      },
      {
        uid: 8,
        keys: ["Two Moons", "the Two Moons"],
        comment: "The Two Moons",
        content:
          "An inn on the north road, named for the two lanterns over its door. Louder and cheaper than the Salt Lantern, and it keeps a standing arrangement with traveling musicians: a bed and a meal for whoever plays the room.",
      },
      {
        uid: 9,
        keys: ["the Longest Night", "drowned bell"],
        comment: "The Longest Night",
        content:
          "A ballad about a bell that rings underwater and the woman who waits for a sailor who is not coming back. Every port claims it. Lucien Vane performs a verse nobody else sings, and will not say where he learned it.",
      },
      {
        uid: 10,
        keys: ["storm season"],
        comment: "The storm season",
        content:
          "From the first gale of autumn to the first clear week of spring, coastal roads flood and the northern packet stops running. Harborlight survives on what was stored in summer and on the Salt Lantern.",
      },
    ],
  );
}

const SOURCE_DIRS = [
  "data/import/backgrounds-seed",
  "data/backgrounds-seed",
  "public/data/backgrounds-seed",
] as const;

function cleanBackgroundName(filename: string): string {
  const name = filename.replace(extname(filename), "");
  const cleaned = name.replace(/\(.*?\)/g, "").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

async function resolveSeedSource(rootDir: string, filename: string): Promise<string | null> {
  try {
    const root = await realpath(rootDir);
    if (root !== resolve(rootDir)) return null;

    const candidate = resolve(root, filename);
    const realCandidate = await realpath(candidate);
    const pathFromRoot = relative(root, realCandidate);
    if (
      realCandidate !== candidate ||
      !pathFromRoot ||
      isAbsolute(pathFromRoot) ||
      pathFromRoot === ".." ||
      pathFromRoot.startsWith(`..${sep}`) ||
      !(await statPrivateFile(realCandidate, Number.MAX_SAFE_INTEGER)).isFile()
    ) {
      return null;
    }
    return realCandidate;
  } catch {
    return null;
  }
}

export async function seedDefaultBackgrounds(): Promise<void> {
  const count = defaultDb.select({ id: backgrounds.id }).from(backgrounds).limit(1).get();
  if (count) return;

  let sourceDir: string | null = null;
  let fileNames: string[] = [];
  for (const candidate of SOURCE_DIRS) {
    try {
      const root = await realpath(candidate);
      if (root !== resolve(candidate)) continue;
      const entries = await readPrivateDirectory(root);
      fileNames = entries
        .map((entry) => (typeof entry === "string" ? entry : entry.name))
        .filter((name) => !name.startsWith("_"));
      sourceDir = root;
      break;
    } catch {
      // Try the next local/private seed location.
    }
  }
  if (!sourceDir) return;

  await ensureUploadsDirs();

  for (const fileName of fileNames) {
    const sourcePath = await resolveSeedSource(sourceDir, fileName);
    if (!sourcePath) continue;

    const storedPath = storedPathFromDiskComponents(
      "backgrounds",
      `${randomUUID()}${extname(fileName)}`,
    );
    const destPath = diskPathFromStored(storedPath);

    try {
      const bytes = await readPrivateFile(sourcePath);
      await writePrivateFileAtomic(destPath, bytes, { rootDir: UPLOADS_DISK_ROOT });
      createBackground({ name: cleanBackgroundName(fileName), path: storedPath });
    } catch (error) {
      await removePrivatePath(destPath, { rootDir: UPLOADS_DISK_ROOT }).catch(() => {});
      throw error;
    }
  }
}

export async function seedSampleData(userId: string): Promise<void> {
  await ensureUploadsDirs();

  const personaId = randomUUID();
  createPersona({
    id: personaId,
    name: "Default",
    description: "Your default persona. Customize this to describe yourself.",
    iconPath: null,
  });

  await seedStarterCharacters();
  seedStarterLorebooks();

  const presetId = randomUUID();
  createPreset({
    id: presetId,
    name: "Creative",
    providerId: null,
    model: null,
    data: { ...DEFAULT_GENERATION_PRESET },
  });

  upsertUserSettings(userId, {
    defaultPresetId: presetId,
    defaultPersonaId: personaId,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    postHistoryInstructions: DEFAULT_POST_HISTORY_INSTRUCTIONS,
    impersonationPrompt: DEFAULT_IMPERSONATION_PROMPT,
  });
}
