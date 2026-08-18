# -*- coding: utf-8 -*-
"""批量生成卡片图：解析 js/data.js，按稀有度分级生成 img/cards/<id>.png
用法：
  python tools/batch_gen.py          # 全量生成（跳过已有图片）
  python tools/batch_gen.py --test   # 只生成 egg-rainbow 测试一张
"""
import os, sys, json, hashlib, subprocess
os.environ.setdefault('HF_HOME', r'D:\PYTHON\hf-cache')
os.environ.setdefault('HF_ENDPOINT', 'https://hf-mirror.com')
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')

EMOJI_EN = {
  '🕯️': 'candle', '🌌': 'starry night sky', '🍄': 'mushroom', '🍀': 'clover',
  '🐺': 'wolf', '🦁': 'lion', '🧬': 'tiny sprout with dna motif', '🐟': 'fish',
  '🌋': 'volcano', '🐏': 'ram', '🪙': 'gold coin', '🦊': 'fox', '🪱': 'worm',
  '🫀': 'heart', '☄️': 'comet', '🧭': 'compass', '🧿': 'evil eye charm',
  '🐤': 'chick', '🐬': 'dolphin', '🪂': 'parachute', '🐕': 'dog', '🐙': 'octopus',
  '🧲': 'magnet', '🐼': 'panda', '🐚': 'seashell', '🐯': 'tiger', '🦠': 'microbe',
  '🛠️': 'hammer and tools', '🦌': 'deer', '🦀': 'crab', '🐡': 'pufferfish',
  '⚒️': 'hammer', '🧜': 'mermaid', '🦨': 'skunk', '🧺': 'basket', '🦾': 'robot arm',
  '🗡️': 'dagger', '🦎': 'gecko', '🐑': 'sheep', '🪓': 'axe', '🐸': 'frog',
  '🧝': 'elf', '🌿': 'vine', '🐳': 'whale', '🐻': 'bear', '🪶': 'feather',
  '🦢': 'swan', '⭐': 'star', '⛏️': 'pickaxe', '🏺': 'amphora', '⚗️': 'alembic flask',
  '⚜️': 'fleur de lis emblem', '🌇': 'sunset', '🦒': 'giraffe', '🗿': 'stone statue',
  '🩸': 'blood drop', '🌟': 'glowing star', '🌊': 'ocean wave', '🦐': 'shrimp',
  '🌷': 'tulip', '🪐': 'ringed planet', '🐄': 'cow', '💎': 'gem', '🔮': 'crystal ball',
  '🪄': 'magic wand', '⚱️': 'funeral urn', '🤖': 'robot', '🦘': 'kangaroo',
  '👽': 'alien', '🌅': 'sunrise', '🐈': 'cat', '🦝': 'raccoon', '🦖': 't rex',
  '🪝': 'hook', '🦤': 'dodo bird', '🐵': 'monkey', '🐝': 'bee', '🧛': 'vampire',
  '🐹': 'hamster', '🌸': 'cherry blossom', '👁️': 'single eye', '⛄': 'snowman',
  '🦆': 'duck', '🦴': 'bone', '🐗': 'wild boar', '🐢': 'turtle', '🪸': 'coral',
  '🐨': 'koala', '⚔️': 'crossed swords', '🌺': 'hibiscus flower', '🦦': 'otter',
  '🦗': 'cricket', '📿': 'prayer beads', '❄️': 'snowflake', '🦑': 'squid',
  '🗝️': 'old key', '🐂': 'ox', '🐰': 'rabbit', '🦫': 'beaver', '⚖️': 'balance scale',
}
EGG_EN = {
  'egg-gold': 'golden egg', 'egg-wood': 'wooden egg', 'egg-water': 'water egg',
  'egg-fire': 'fire egg', 'egg-earth': 'earth egg', 'egg-rainbow': 'rainbow egg',
}
# 每张卡的英文形象提示词（由卡片文案翻译而来，SDXL 不支持中文直接作画）
CARDS_EN = {
  'green-01': 'a tiny cute messenger holding a glowing candle, patrolling at night',
  'green-02': 'a cute apprentice lying on a blade of grass counting stars in the night sky',
  'green-03': 'a cute mushroom spirit holding an umbrella, raindrops on the cap',
  'green-04': 'a cute clover spirit weaving a flower crown from vines',
  'green-05': 'a cute wolf spirit guarding the first fruit of an orchard',
  'green-06': 'a cute lion cub sprout guarding a field of seeds',
  'green-07': 'a tiny cute sprout with a dna helix motif, smaller than a thumb',
  'green-08': 'a cute moss covered child spirit sliding between stones by a stream',
  'green-09': 'a sprout growing out of volcanic ash, glowing embers around',
  'green-10': 'a cute ram priest holding a bamboo divination stick',
  'green-11': 'a cute pinecone spirit hoarding shiny pinecones like coins',
  'green-12': 'a green fox forest guard patrolling, tail held high like a flag',
  'green-13': 'a cute creature squatting by a brook watching insects',
  'green-14': 'a tiny princess peeking from a bamboo joint, cherry blossoms blooming',
  'green-15': 'a cute lady in a moss green cloak, grass growing under her feet',
  'green-16': 'a cute priest holding up a dandelion compass, dandelion seeds drifting',
  'blue-01': 'a cute water spirit with a big evil eye charm, rising from a clear spring',
  'blue-02': 'a cute chick soldier wrapped in morning mist at dawn',
  'blue-03': 'a cute snow spirit playing in fresh snow, tiny snowflakes around',
  'blue-04': 'a graceful messenger gliding over ocean waves holding a seashell letter',
  'blue-05': 'a cute water dragon dog admiring its reflection in a calm lake',
  'blue-06': 'a cute octopus crab walking sideways at the bottom of a lake',
  'blue-07': 'a cute water spirit collecting glowing ripples in glass jars',
  'blue-08': 'a cute panda snow guard standing at the edge of a frozen lake',
  'blue-09': 'a cute beast with a shell of ice, breath forming white frost',
  'blue-10': 'a mighty tiger spirit twisting a waterfall into a rope',
  'blue-11': 'a cute water wave scholar teaching a class of ripples',
  'blue-12': 'a giant whale resting at the bottom of a lake, a tiny city on its back',
  'blue-13': 'a graceful water deer running across the surface of a lake, ripples under hooves',
  'blue-14': 'a majestic deep sea dragon coiled in dark water, claws reaching for moonlight',
  'blue-15': 'a cute pufferfish scholar puffed up into a ball',
  'blue-16': 'a shark mermaid blacksmith forging a hammer inside a waterfall',
  'purple-01': 'a charming mermaid general singing by moonlight, tides rising',
  'purple-02': 'a dapper skunk count with an upright collar, storm clouds behind',
  'purple-03': 'a mysterious mage carrying a basket of glowing stars',
  'purple-04': 'an elegant vampire count with ornate mechanical arms',
  'purple-05': 'a shadow mage wielding a dagger made of pure shadow',
  'purple-06': 'a gecko noble crawling along a moonlit wall, shadow like',
  'purple-07': 'a sleepy sheep wizard surrounded by drifting dream clouds',
  'purple-08': 'a grim marquis holding a great axe, splitting the dark night',
  'purple-09': 'a frog wizard casting glowing spells under the full moon',
  'purple-10': 'an elf count with sharp crescent ears under moonlight',
  'purple-11': 'a night general in a cloak of glowing vines, leaves sprouting in his steps',
  'purple-12': 'a whale priest singing deep hymns at the bottom of the sea',
  'purple-13': 'a bear count napping against a bell tower at dawn',
  'purple-14': 'a dapper marquis collecting glowing feathers at dusk',
  'purple-15': 'a knight riding a swan at sunset, cape of orange clouds',
  'purple-16': 'a hooded priest pointing at a bright star in the night sky',
  'gold-01': 'a regal dwarf lord with a crown made from a golden pickaxe',
  'gold-02': 'a majestic tiger king emerging from an ancient golden urn',
  'gold-03': 'a wise chancellor holding an alchemical flask, scrolls of recipes',
  'gold-04': 'a heroic marshal in golden armor holding a fleur de lis shield',
  'gold-05': 'a leopard lord pacing a mountain ridge at golden sunset',
  'gold-06': 'a tall crane general standing on a castle tower lookout',
  'gold-07': 'an ancient stone statue marshal coming alive in a hall of marble',
  'gold-08': 'a regal red crowned crane king, feathers like sunset',
  'gold-09': 'a radiant marshal with a sword adorned with a comet tail',
  'gold-10': 'a divine qilin prophet walking on ocean waves, scrolls of prophecy',
  'gold-11': 'a regal shrimp claw monarch sitting on a golden throne',
  'gold-12': 'a noble qilin chancellor holding a tulip, diplomatic and calm',
  'gold-13': 'a cosmic prophet with a glowing ringed planet halo',
  'gold-14': 'a proud bull horn priest on a golden altar',
  'gold-15': 'a powerful chancellor holding a jeweled scepter in a grand hall',
  'gold-16': 'a knight commander holding a glowing crystal ball as shield',
  'red-01': 'a demon lord with a magic wand, scorched earth and embers',
  'red-02': 'a fire demon king rising from a burning funeral urn',
  'red-03': 'a colossal dark robot devouring rocks, gears as teeth',
  'red-04': 'a menacing kangaroo emperor in dark armor, ruined city behind',
  'red-05': 'a terrifying alien overlord from outer space, cracked pupils',
  'red-06': 'a dark reaper with a scythe gleaming at sunrise',
  'red-07': 'a huge demonic cat licking blood red light, haunting',
  'red-08': 'a sinister raccoon villain clutching a stolen beam of moonlight',
  'red-09': 'an ancient t rex beast with glowing magma scales',
  'red-10': 'a dark grand duke holding a giant hook, storm of smoke',
  'red-11': 'a vengeful dodo god with clenched talons, dark clouds',
  'red-12': 'a sinister monkey reaper scattering dark omens from a sack',
  'red-13': 'a demon king formed from a swarm of dark bees',
  'red-14': 'an ancient vampire god sipping a cup of dark resentment',
  'red-15': 'a sinister rat faced emperor on a throne of grain sacks',
  'red-16': 'a sinister beauty with petals stained in blood red',
  'red-17': 'a dread lord with a giant half open all seeing eye',
  'red-18': 'a chilling snowman warden of an ice prison, keys of ice',
  'black-01': 'a colossal black duck rising from a cosmic abyss, wings covering the sky',
  'black-02': 'a cosmic deity made of ancient bones, stars orbiting',
  'black-03': 'a primordial cosmic boar with tusks carving through chaos',
  'black-04': 'an ancient celestial turtle with a shell engraved with calendars',
  'black-05': 'a cosmic sage formed from glowing coral, tentacles reaching into the void',
  'black-06': 'a sleepy cosmic koala, galaxy slowly turning behind',
  'black-07': 'a cosmic swordsman whose blade silences all, starry void',
  'black-08': 'a divine figure with flower petals each holding a galaxy',
  'black-09': 'a cosmic otter sage meditating on a mirror of water, ripples of light',
  'black-10': 'a cosmic cricket made of pure light, first sound of creation',
  'black-11': 'a cosmic deity counting prayer beads of reincarnation',
  'black-12': 'an ice wanderer walking into a frozen void, eternal frost',
  'black-13': 'a colossal squid guarding a cosmic tomb, tentacles as gates',
  'black-14': 'a silhouette holding a glowing key before a gate of nothingness',
  'black-15': 'a cosmic ox with horns against the void, stars shattering',
  'black-16': 'a cosmic moon rabbit deity pounding a mortar of starlight',
  'black-17': 'a cosmic beaver building a dam from mirror reflections',
  'black-18': 'a cosmic deity with a giant balance scale weighing a sun',
}
# 稀有度分级：低稀有度简单朴素、高稀有度更精致华丽（分辨率统一 1024 保证比例）
RARITY_CFG = {
  'white':   dict(steps=25, cfg=5.5, extra='simple cute adorable, plain pastel background, minimal detail'),
  'green':   dict(steps=28, cfg=6.0, extra='cute nature spirit, lush forest, emerald green palette'),
  'blue':    dict(steps=32, cfg=6.5, extra='graceful water spirit, ocean mist, azure blue palette'),
  'purple':  dict(steps=35, cfg=6.5, extra='mysterious arcane mage, moonlight, violet palette, glowing runes'),
  'gold':    dict(steps=38, cfg=7.0, extra='majestic royal legend, golden palace, gold and amber palette, ornate details'),
  'red':     dict(steps=42, cfg=7.0, extra='epic dark lord, burning battlefield, crimson palette, dramatic but dignified'),
  'black':   dict(steps=46, cfg=7.5, extra='cosmic primordial deity, void of stars, obsidian and silver palette, epic scale'),
  'rainbow': dict(steps=50, cfg=7.5, extra='transcendent god, radiant divine glow, iridescent rainbow palette, awe inspiring'),
}
# 统一画风锚定（所有卡共用，保证风格一致）
STYLE = ('hand painted mobile fantasy card game art, soft cel shading, thick clean lineart, gentle gradients, '
         'bright cheerful lighting, front facing bust portrait, single subject centered with margin around, '
         'clear silhouette, simple clean background, fantasy trading card game illustration, vibrant colors, '
         'clean composition, highly detailed, masterpiece quality')
NEG = ('deformed, disfigured, bad anatomy, extra limbs, missing limbs, extra fingers, mutated hands, '
       'poorly drawn hands, blurry, low quality, watermark, text, signature, multiple characters, duplicate, '
       'nudity, gore, blood, horror, scary face, body horror')


def main():
    test = '--test' in sys.argv
    tmp = os.path.join(os.environ.get('TEMP', '.'), 'geg_cards.json')
    out = subprocess.run(
        ['node', '-e', f"const fs=require('fs');eval(fs.readFileSync('js/data.js','utf8')+';fs.writeFileSync(process.argv[1], JSON.stringify(CARDS), \"utf8\")')", tmp],
        capture_output=True)
    if out.returncode != 0:
        print('解析 data.js 失败:', out.stderr)
        sys.exit(1)
    with open(tmp, encoding='utf-8') as f:
        cards = json.load(f)
    os.remove(tmp)

    import torch
    from diffusers import StableDiffusionXLPipeline
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f'设备: {dev}', flush=True)
    pipe = StableDiffusionXLPipeline.from_pretrained(
        'stabilityai/stable-diffusion-xl-base-1.0',
        torch_dtype=torch.float16 if dev == 'cuda' else torch.float32,
        safety_checker=None)
    pipe = pipe.to(dev)
    if dev == 'cuda':
        pipe.enable_model_cpu_offload()
        pipe.enable_vae_slicing()
    else:
        pipe.enable_attention_slicing()

    targets = [c for c in cards if c['id'] == 'egg-rainbow'] if test else cards
    for c in targets:
        cid = c['id']
        path = f"img/cards/{cid}.png"
        if os.path.exists(path) and not test:
            continue
        art = c.get('art') or {}
        theme = CARDS_EN.get(cid) or EGG_EN.get(cid) or EMOJI_EN.get(art.get('emoji', ''), c['name'])
        cfg = RARITY_CFG[c['rarity']]
        prompt = f"{theme}, {cfg['extra']}{STYLE}"
        seed = int(hashlib.md5(cid.encode()).hexdigest()[:8], 16)
        gen = torch.Generator(device='cpu').manual_seed(seed)
        img = pipe(prompt, negative_prompt=NEG, num_inference_steps=cfg['steps'],
                   guidance_scale=cfg['cfg'], width=1024, height=1024,
                   generator=gen).images[0]
        img.save(path)
        print(f"已生成: {cid} (1024px, {cfg['steps']}步) seed={seed}", flush=True)
    print('全部完成')


if __name__ == '__main__':
    main()