/**
 * Curated knowledge about popular Imgflip templates.
 *
 * Imgflip only returns a name for each template; this catalog adds when to use it
 * and, where the default box order is well known, what goes in each box. It is
 * keyed by template ID and merged with live data from /get_memes, so templates
 * missing from here are still listed (just without guidance).
 */
export interface TemplateGuide {
  /** When the format fits. */
  usage: string;
  /** Meaning of each text box in Imgflip's default order, when known. */
  boxes?: string[];
  /** Extra search keywords (English and Italian), concepts and emotions. */
  tags: string[];
}

export const TEMPLATE_GUIDES: Record<string, TemplateGuide> = {
  "181913649": {
    usage: "Rejecting one option and preferring another. Classic 'this, not that'.",
    boxes: ["the thing rejected (Drake says no)", "the thing preferred (Drake approves)"],
    tags: ["preference", "choice", "no yes", "better", "instead", "preferenza", "scelta", "meglio", "rifiuto"],
  },
  "91998305": {
    usage: "Same as Drake Hotline Bling, blank variant: reject the first, prefer the second.",
    boxes: ["rejected thing", "preferred thing"],
    tags: ["preference", "choice", "preferenza", "scelta"],
  },
  "129315248": {
    usage: "Short 'no / yes' comparison between two options.",
    boxes: ["what you say no to", "what you say yes to"],
    tags: ["preference", "choice", "no yes", "scelta"],
  },
  "87743020": {
    usage: "Agonising over two options that are both tempting or conflicting.",
    boxes: ["left button option", "right button option", "the sweating person who must choose"],
    tags: ["dilemma", "choice", "decision", "hard", "indecision", "scelta", "dilemma", "indeciso", "decisione"],
  },
  "112126428": {
    usage: "Someone distracted by a new temptation while neglecting what they already have.",
    boxes: ["the new tempting thing (woman in red)", "the distracted person (boyfriend)", "what they already have / should focus on (girlfriend)"],
    tags: ["temptation", "distraction", "new shiny", "betrayal", "tentazione", "distrazione", "tradimento", "novità"],
  },
  "124822590": {
    usage: "Swerving to the impulsive/bad choice instead of the sensible one.",
    boxes: ["the sensible option (straight ahead)", "the impulsive option (exit)", "the person/car swerving"],
    tags: ["choice", "impulsive", "bad decision", "swerve", "scelta", "impulsivo", "decisione sbagliata"],
  },
  "309668311": {
    usage: "Choosing between two paths or outcomes.",
    tags: ["choice", "path", "fork", "scelta", "bivio"],
  },
  "222403160": {
    usage: "Asking for the same thing again, tired and repetitive request.",
    boxes: ["top text (usually the context)", "'I am once again asking for…' request"],
    tags: ["asking again", "request", "repeat", "beg", "chiedere ancora", "richiesta", "di nuovo"],
  },
  "224015000": {
    usage: "Asking for the same thing again, tired and repetitive request.",
    boxes: ["top text", "'once again asking' request"],
    tags: ["asking again", "request", "repeat", "chiedere ancora"],
  },
  "217743513": {
    usage: "Someone would rather suffer a big penalty than do something simple.",
    boxes: ["the simple thing to do or 'draw 25'", "the person holding a big pile of cards"],
    tags: ["stubborn", "refuse", "rather", "penalty", "testardo", "piuttosto", "rifiutare"],
  },
  "252600902": {
    usage: "Revealing that something was always the case ('Wait, it's all X?' / 'Always has been').",
    boxes: ["astronaut realisation 'Wait, it's all X?'", "'Always has been'"],
    tags: ["realisation", "always", "truth", "conspiracy", "rivelazione", "sempre stato", "verità"],
  },
  "322841258": {
    usage: "Someone says something, the other assumes a good outcome and is met with ominous silence.",
    boxes: ["Anakin's statement", "Padme's hopeful assumption '…right?'", "Padme repeating the assumption, worried"],
    tags: ["assumption", "silence", "ominous", "right", "supposizione", "silenzio", "vero?"],
  },
  "135256802": {
    usage: "Two different groups agreeing on one shared thing.",
    boxes: ["first group (left arm)", "second group (right arm)", "the thing they agree on (handshake)"],
    tags: ["agreement", "common ground", "unity", "both", "accordo", "in comune", "entrambi"],
  },
  "131940431": {
    usage: "A plan that backfires: the third step reveals the flaw, the fourth repeats it in shock.",
    boxes: ["step 1", "step 2", "step 3 (the flaw)", "step 3 repeated (Gru realises)"],
    tags: ["plan", "backfire", "fail", "steps", "piano", "fallimento", "ritorcersi"],
  },
  "131087935": {
    usage: "Someone being held back from something they want while it gets away.",
    tags: ["held back", "lost", "chasing", "trattenuto", "perdere"],
  },
  "97984": {
    usage: "Smugly enjoying chaos or disaster you caused.",
    boxes: ["top text", "bottom text"],
    tags: ["chaos", "fire", "evil", "disaster", "caos", "disastro", "malvagio"],
  },
  "4087833": {
    usage: "Waiting forever for something that never happens.",
    boxes: ["top text", "bottom text"],
    tags: ["waiting", "forever", "never", "attesa", "aspettare", "mai"],
  },
  "80707627": {
    usage: "Loneliness or boredom while waiting for something; three panels of sadness.",
    tags: ["lonely", "waiting", "sad", "bored", "solitudine", "triste", "noia", "attesa"],
  },
  "91538330": {
    usage: "Something being everywhere ('X, X everywhere').",
    boxes: ["'X'", "'X everywhere'"],
    tags: ["everywhere", "ubiquitous", "dappertutto", "ovunque"],
  },
  "309868304": {
    usage: "Proposing an (often unfair or funny) exchange.",
    boxes: ["what I receive", "what you receive", "title (Trade offer)"],
    tags: ["deal", "trade", "exchange", "offer", "scambio", "offerta", "affare"],
  },
  "129242436": {
    usage: "Stating a controversial opinion and daring others to disagree.",
    boxes: ["the opinion on the sign", "optional bottom text"],
    tags: ["opinion", "controversial", "debate", "hot take", "opinione", "discutibile", "dibattito"],
  },
  "124055727": {
    usage: "Desperately craving more of something.",
    boxes: ["top text", "'Y'all got any more of that…'"],
    tags: ["craving", "addicted", "more", "voglia", "dipendenza", "ancora"],
  },
  "188390779": {
    usage: "An angry accusation answered by a confused or dismissive reaction.",
    boxes: ["the yelling woman (accusation)", "the confused cat (response)"],
    tags: ["argument", "angry", "confused", "litigio", "arrabbiato", "confuso", "accusa"],
  },
  "438680": {
    usage: "Shutting down a dumb remark with a slap.",
    boxes: ["Robin's dumb statement", "Batman's retort"],
    tags: ["shut up", "slap", "correction", "zittire", "schiaffo", "correzione"],
  },
  "161865971": {
    usage: "Mock 'marked safe from' notice for a (silly) disaster.",
    boxes: ["'Marked safe from'", "the disaster"],
    tags: ["safe", "survived", "sopravvissuto", "salvo"],
  },
  "101470": {
    usage: "Absurdly blaming something on an unlikely cause ('Aliens').",
    boxes: ["setup", "'Aliens' style conclusion"],
    tags: ["explanation", "conspiracy", "aliens", "spiegazione", "complotto", "alieni"],
  },
  "79132341": {
    usage: "Sabotaging yourself, then blaming something else.",
    boxes: ["the person riding", "self-sabotaging action (stick in wheel)", "blaming someone else on the ground"],
    tags: ["self sabotage", "blame", "fault", "autosabotaggio", "colpa", "incolpare"],
  },
  "102156234": {
    usage: "Mocking a statement by repeating it in alternating case.",
    boxes: ["original statement", "mOcKiNg repetition"],
    tags: ["mocking", "sarcasm", "presa in giro", "sarcasmo"],
  },
  "100777631": {
    usage: "Misidentifying something obvious out of ignorance.",
    boxes: ["the thing being misidentified (butterfly)", "the confused person", "'Is this a …?' question"],
    tags: ["misunderstanding", "ignorant", "wrong", "fraintendere", "ignorante", "sbagliato"],
  },
  "142009471": {
    usage: "Misidentifying something obvious (same format as 'Is This A Pigeon').",
    boxes: ["the thing", "the person", "'Is this a …?'"],
    tags: ["misunderstanding", "fraintendere"],
  },
  "61579": {
    usage: "Something that is harder than it looks ('One does not simply…').",
    boxes: ["'One does not simply'", "the hard task"],
    tags: ["difficult", "hard", "impossible", "difficile", "impossibile"],
  },
  "247375501": {
    usage: "Strong/glorious past vs weak/pathetic present (or two contrasting versions).",
    boxes: ["label for the buff doge (strong)", "label for cheems (weak)", "what the buff doge says/does", "what cheems says/does"],
    tags: ["then vs now", "strong weak", "comparison", "past", "prima e dopo", "forte debole", "confronto"],
  },
  "177682295": {
    usage: "Pointing out that someone gets rewarded for something you do for free.",
    boxes: ["top text", "'You guys are getting paid?'"],
    tags: ["paid", "free work", "money", "pagato", "gratis", "soldi", "lavoro"],
  },
  "427308417": {
    usage: "Workplace-style counter reset by a recurring incident.",
    boxes: ["number of days", "the incident"],
    tags: ["days without", "accident", "again", "giorni senza", "incidente", "ancora"],
  },
  "180190441": {
    usage: "Pointing out that two supposedly different things are identical.",
    boxes: ["first thing", "second thing", "'They're the same picture' caption"],
    tags: ["same", "identical", "no difference", "uguale", "stessa cosa", "identico"],
  },
  "252758727": {
    usage: "Paying attention to one thing while ignoring another that is in trouble.",
    boxes: ["the favourite getting attention (mother)", "the favoured child", "the neglected one drowning", "skeleton at the bottom (long neglected)"],
    tags: ["neglect", "favourite", "ignore", "ignorare", "preferito", "trascurare"],
  },
  "67452763": {
    usage: "Watching others enjoy something from the outside, envious.",
    tags: ["envy", "outside", "lonely", "invidia", "escluso"],
  },
  "505705955": {
    usage: "Declaring something a masterpiece.",
    boxes: ["top text", "'Absolute cinema'"],
    tags: ["masterpiece", "perfect", "capolavoro", "perfetto"],
  },
  "93895088": {
    usage: "Ideas getting increasingly 'enlightened' (often ironically worse).",
    boxes: ["basic idea", "smarter idea", "even smarter", "galaxy-brain idea"],
    tags: ["escalation", "smart", "galaxy brain", "levels", "escalation", "intelligente", "livelli"],
  },
  "3218037": {
    usage: "Having no achievements to show.",
    boxes: ["top text", "'This is where I'd put my trophy…'"],
    tags: ["failure", "no trophy", "loser", "fallimento", "perdente"],
  },
  "28251713": {
    usage: "Giving something to everyone.",
    boxes: ["'You get a X'", "'Everybody gets a X'"],
    tags: ["everyone", "everybody", "giveaway", "tutti", "regalo"],
  },
  "178591752": {
    usage: "Normal way vs fancy/sophisticated way of saying the same thing.",
    boxes: ["normal version", "fancy version"],
    tags: ["fancy", "classy", "sophisticated", "elegante", "raffinato"],
  },
  "370867422": {
    usage: "Peeking hopefully: 'no X?'.",
    tags: ["no", "peeking", "hopeful", "speranza"],
  },
  "77045868": {
    usage: "Offering a much lower deal than expected.",
    boxes: ["the offer request", "'Best I can do is…'"],
    tags: ["deal", "lowball", "negotiation", "trattativa", "offerta bassa"],
  },
  "55311130": {
    usage: "Pretending everything is fine while things are falling apart.",
    boxes: ["top text (the situation)", "'This is fine'"],
    tags: ["denial", "fire", "chaos", "everything is fine", "disaster", "negazione", "tutto bene", "caos", "fuoco"],
  },
  "110163934": {
    usage: "Partner assumes one thing while the other is thinking about something unrelated.",
    boxes: ["what she thinks", "what he is actually thinking"],
    tags: ["overthinking", "thinking", "relationship", "pensare", "coppia"],
  },
  "533936279": {
    usage: "Low-IQ and high-IQ reach the same conclusion while the average overthinks.",
    boxes: ["low-IQ take", "average overthinking take", "high-IQ take (same as low)"],
    tags: ["iq", "midwit", "overthinking", "intelligenza", "pensare troppo"],
  },
  "284929871": {
    usage: "Having a secret that people around you don't know.",
    boxes: ["'They don't know…'", "the secret"],
    tags: ["secret", "party", "segreto", "festa"],
  },
  "354700819": {
    usage: "Two perspectives on the same situation: one sees doom, the other sees beauty.",
    boxes: ["the pessimist (window side, rock)", "the optimist (view)"],
    tags: ["perspective", "optimist", "pessimist", "punti di vista", "ottimista", "pessimista"],
  },
  "195515965": {
    usage: "Building up an increasingly ridiculous argument step by step.",
    boxes: ["step 1", "step 2", "step 3", "clown conclusion"],
    tags: ["clown", "foolish", "escalation", "pagliaccio", "stupido"],
  },
  "148909805": {
    usage: "Awkwardly looking away after something uncomfortable.",
    boxes: ["the awkward situation", "bottom text"],
    tags: ["awkward", "look away", "nervous", "imbarazzo", "imbarazzante"],
  },
  "137501417": {
    usage: "Replacing one thing with another as your new favourite.",
    tags: ["friendship ended", "replace", "new best friend", "sostituire", "amicizia"],
  },
  "163573": {
    usage: "Exaggerating with a rainbow 'Imagination'.",
    boxes: ["top text", "'Imagination'"],
    tags: ["imagination", "immaginazione"],
  },
  "89370399": {
    usage: "Absurd 'smart' life hack logic.",
    boxes: ["top text", "the flawed logic"],
    tags: ["life hack", "logic", "smart", "trick", "trucco", "logica", "furbo"],
  },
  "206151308": {
    usage: "Three people/things pointing at each other because they are the same.",
    tags: ["same", "pointing", "blame", "uguali", "accusare"],
  },
  "1035805": {
    usage: "The sensible suggestion gets thrown out the window by the boss.",
    boxes: ["the boss's question", "first suggestion", "second suggestion", "the sensible suggestion (thrown out)"],
    tags: ["meeting", "boss", "work", "suggestion", "riunione", "capo", "lavoro", "proposta"],
  },
  "27813981": {
    usage: "Smiling through pain or a bad situation.",
    boxes: ["top text", "bottom text"],
    tags: ["pain", "pretend", "smile", "dolore", "fingere", "sorriso"],
  },
  "119215120": {
    usage: "Comparing types of pain, the last one being the worst.",
    tags: ["headache", "pain", "types", "mal di testa", "dolore"],
  },
  "84341851": {
    usage: "Inner voice tempting you to do the bad thing.",
    boxes: ["the situation / good self", "the evil inner voice"],
    tags: ["temptation", "evil", "inner voice", "tentazione", "voce interiore", "cattivo"],
  },
  "187102311": {
    usage: "Three heads representing three groups, one of which is the odd one out.",
    tags: ["three", "groups", "odd one out", "tre", "gruppi"],
  },
  "216523697": {
    usage: "Expressing group hatred for something.",
    boxes: ["'All my homies hate X'", "bottom text"],
    tags: ["hate", "everyone", "odiare"],
  },
  "166969924": {
    usage: "Fixing a huge problem with a lazy patch.",
    tags: ["quick fix", "patch", "workaround", "toppa", "soluzione rapida"],
  },
  "99683372": {
    usage: "Seemingly ignoring something, then suddenly paying attention.",
    boxes: ["top text", "bottom text"],
    tags: ["sleep", "awake", "attention", "dormire", "sveglio"],
  },
  "259237855": {
    usage: "Laughing at someone's statement.",
    tags: ["laugh", "ridere", "ridicolo"],
  },
  "133946291": {
    usage: "Claiming expertise in something because of a trivial experience.",
    boxes: ["the trivial experience", "'I'm something of a scientist myself'"],
    tags: ["expert", "scientist", "expertise", "esperto", "scienziato"],
  },
  "61585": {
    usage: "Unbelievable bad luck.",
    boxes: ["setup", "unlucky outcome"],
    tags: ["bad luck", "unlucky", "sfortuna", "sfigato"],
  },
  "226297822": {
    usage: "Panic, relief, then panic again.",
    boxes: ["first panic reason", "the calming thought", "the new panic"],
    tags: ["panic", "calm", "anxiety", "panico", "calma", "ansia"],
  },
  "114585149": {
    usage: "Building up to an explosive reaction.",
    tags: ["scream", "buildup", "rage", "urlo", "rabbia"],
  },
  "145139900": {
    usage: "Revealing what something really is under the mask.",
    boxes: ["setup 'Let's see who this really is'", "the apparent thing", "the reveal", "the true identity"],
    tags: ["reveal", "mask", "truth", "smascherare", "rivelazione", "verità"],
  },
  "104893621": {
    usage: "Something taking out things one after another.",
    tags: ["death", "one by one", "morte", "uno dopo l'altro"],
  },
  "110133729": {
    usage: "Two people accusing each other of being the same.",
    boxes: ["first party", "second party"],
    tags: ["same", "pointing", "uguali", "accusare"],
  },
  "162372564": {
    usage: "A small cause leading to a huge consequence.",
    boxes: ["small cause", "huge consequence"],
    tags: ["chain reaction", "cause effect", "domino", "conseguenza", "effetto domino"],
  },
  "155067746": {
    usage: "Being surprised by an obvious consequence of your own actions.",
    boxes: ["what you did", "the obvious consequence", "surprised reaction"],
    tags: ["surprised", "consequence", "obvious", "sorpresa", "conseguenza", "ovvio"],
  },
  "61520": {
    usage: "Being unsure whether one thing is actually another ('Not sure if…').",
    boxes: ["'Not sure if…'", "'…or just…'"],
    tags: ["suspicious", "unsure", "squint", "dubbio", "sospettoso"],
  },
  "119139145": {
    usage: "Unable to resist pressing the button (agreeing with something).",
    tags: ["button", "agree", "bottone", "d'accordo"],
  },
  "61556": {
    usage: "Older person discovering something technological.",
    boxes: ["top text", "bottom text"],
    tags: ["grandma", "internet", "technology", "boomer", "nonna", "tecnologia"],
  },
  "5496396": {
    usage: "Toasting to someone or something.",
    boxes: ["top text", "bottom text"],
    tags: ["cheers", "toast", "congratulations", "brindisi", "complimenti"],
  },
  "123999232": {
    usage: "Reacting with disgust to an uncomfortable truth.",
    tags: ["truth", "denial", "verità", "negazione"],
  },
  "21735": {
    usage: "A passenger's question that is awkwardly answered or misheard.",
    tags: ["conversation", "awkward", "conversazione"],
  },
  "16464531": {
    usage: "Making a passive-aggressive remark, then sipping tea.",
    boxes: ["the remark", "'But that's none of my business'"],
    tags: ["passive aggressive", "gossip", "tea", "pettegolezzo", "passivo aggressivo"],
  },
  "342785297": {
    usage: "Comparing yourself to someone and claiming superiority.",
    boxes: ["what I do", "what you do", "'We are not the same'"],
    tags: ["superiority", "different", "superiore", "diversi"],
  },
};
