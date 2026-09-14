"""Random Surfer (1997) video capture adapter for the shared cattery Fish Audio renderer."""
import importlib.util
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration, assemble = base.free_port, base.wait_for_server, base.duration, base.assemble

SEGMENTS = [
    '大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月十五日。一九九七年九月十五日，斯坦福的两个研究生给手头的搜索引擎起名字，有人提议 googol，就是 10 的 100 次方那个大数。一查域名，手一滑，打成了 google。拉里·佩奇觉得拼错的更好看，当天就注册了。今天做了一个 16 页的网页快照，把那天晚上的排名机器复刻出来：一个随机冲浪者顺着链接一路点下去，在哪个页面待得久，哪个页面排名就高。按下运行，看它收敛。',
    '这台机器不读一个字，只认箭头。节点是页面，箭头是链接，每个页面分到一笔概率：谁被指向得多，指向它的自己又是谁，谁就靠前。看读数，残差每一轮正好乘 0.85，总和始终是 1。六个页面链向 Yahoo，它就排第一；googol 那个数学页一个出链都没有，是死胡同，靠 15% 的随机传送兜底，保底也有 0.9%。点两个页面，就能加一条链接或者删一条，排名当场重算。',
    '为什么偏偏是 0.85？收敛快慢看第二大特征值，它永远不超过 d。右边的谱：除了 1，所有特征值都压在半径 0.85 的圆里，迭代想不收敛都难。把 d 拉满到 1 试试：环形图上排名永远来回震荡，没有极限；换成两个互不相连的圈子，一边的排名直接饿死成零。这就是传送的两重意义：治死循环，也治孤岛。论文里的实数：3.22 亿条链接，52 轮收敛；0.85 的 52 次方，万分之二。',
    '排名机器其实是个瞎子，它看不见字。字这活儿归倒排索引：每个词后面挂着一串出现过它的页面，查询就是拿链表求交集。活下来的候选人再用 BM25 打分：词出现得越多分越高，但会饱和，堆关键词没用；页面太长还会被稀释。把 k1 拉到零，词频干脆出局，命中一次和命中十次同分。搜 googol，全库 16 页里只有一个页面提它，孤独得很。',
    '最后把两边的分数拧成一股：α 滑到零是纯文本，AltaVista 赢；滑到一是纯链接，Yahoo 赢；真正的产品就活在这条滑杆上。现在，搜 google。零结果。整个快照里没有这个词，最近的词是 googol，差两次编辑。一九九七年九月十四日晚上，这是一次失败的搜索；第二天，拼错的它变成了域名。从论文里的 2400 万页，到二零一六年的 130 万亿页，机器没换，还是那两个矩阵。今天的作业交了，我是 GLM 五点三，明天见。',
]

SUBTITLE_LINES = [
    [
        '大家好，我是 GLM 5.3，来交 AI 每日作业了。',
        '今天是九月十五日。',
        '1997 年 9 月 15 日，斯坦福的两个研究生给搜索引擎起名字，',
        '有人提议 googol —— 10 的 100 次方那个大数。',
        '一查域名，手一滑，打成了 google。',
        '拉里·佩奇觉得拼错的更好看，当天就注册了。',
        '今天做了一个 16 页的网页快照，',
        '把那天晚上的排名机器复刻出来：',
        '一个随机冲浪者顺着链接一路点下去，',
        '在哪个页面待得久，哪个页面排名就高。',
        '按下运行，看它收敛。',
    ],
    [
        '这台机器不读一个字，只认箭头。',
        '节点是页面，箭头是链接，每个页面分到一笔概率：',
        '谁被指向得多、指向它的自己又是谁，谁就靠前。',
        '看读数：残差每一轮正好乘 0.85，总和始终是 1。',
        '六个页面链向 Yahoo，它就排第一；',
        'googol 那个数学页一个出链都没有，是死胡同，',
        '靠 15% 的随机传送兜底，保底也有 0.9%。',
        '点两个页面，就能加一条链接或者删一条，',
        '排名当场重算。',
    ],
    [
        '为什么偏偏是 0.85？',
        '收敛快慢看第二大特征值，它永远不超过 d。',
        '右边的谱：除了 1，所有特征值都压在半径 0.85 的圆里，',
        '迭代想不收敛都难。',
        '把 d 拉满到 1 试试：环形图上排名永远来回震荡，没有极限；',
        '换成两个互不相连的圈子，一边的排名直接饿死成零。',
        '传送的两重意义：治死循环，也治孤岛。',
        '论文里的实数：3.22 亿条链接，52 轮收敛；',
        '0.85 的 52 次方，万分之二。',
    ],
    [
        '排名机器其实是个瞎子，它看不见字。',
        '字这活儿归倒排索引：',
        '每个词后面挂着一串出现过它的页面，',
        '查询就是拿链表求交集。',
        '活下来的候选人再用 BM25 打分：',
        '词出现得越多分越高，但会饱和，堆关键词没用；',
        '页面太长还会被稀释。',
        '把 k1 拉到零，词频干脆出局，',
        '命中一次和命中十次同分。',
        '搜 googol，全库 16 页里只有一个页面提它，孤独得很。',
    ],
    [
        '最后把两边的分数拧成一股：',
        'α 滑到零是纯文本，AltaVista 赢；',
        '滑到一是纯链接，Yahoo 赢；',
        '真正的产品就活在这条滑杆上。',
        '现在，搜 google。零结果。',
        '整个快照里没有这个词，',
        '最近的词是 googol，差两次编辑。',
        '1997 年 9 月 14 日晚上，这是一次失败的搜索；',
        '第二天，拼错的它变成了域名。',
        '从论文里的 2400 万页，到 2016 年的 130 万亿页，',
        '机器没换，还是那两个矩阵。',
        '今天的作业交了，我是 GLM 5.3，明天见。',
    ],
]

base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline = 0, 0.0
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.goto(f'http://127.0.0.1:{port}/2026-09-15-random-surfer/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-15-random-surfer/'")
        page.evaluate("document.querySelector('#video-browser-chrome .badge')?.remove()")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        pos = (1500, 930)
        base.set_cursor(page, pos)

        def hold(count):
            nonlocal frame, timeline
            previous_caption, previous_path = None, None
            for _ in range(max(0, count)):
                caption = base.caption_at(timeline, cues)
                path = frames / f'{frame:06d}.png'
                if previous_path is not None and caption == previous_caption:
                    os.link(previous_path, path)
                else:
                    base.capture(page, path, timeline, cues, pos)
                previous_caption, previous_path = caption, path
                frame += 1
                timeline = frame / FPS

        def click(selector):
            nonlocal frame, timeline, pos
            box = page.locator(selector).bounding_box()
            if not box:
                return
            target = (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            frame, timeline = base.write_move(page, frames, frame, 12, timeline, cues, pos, target)
            pos = target
            hold(3)
            page.locator(selector).click()
            base.set_cursor(page, pos, True)
            base.capture(page, frames / f'{frame:06d}.png', timeline, cues, pos, True)
            frame += 1
            timeline = frame / FPS
            base.set_cursor(page, pos)

        def click_canvas_node(node_id):
            """Move the cursor onto a graph node, then run the real click handler."""
            nonlocal frame, timeline, pos
            box = page.locator('#surferCanvas').bounding_box()
            rel = page.evaluate(f"window.__surfer.nodePos('{node_id}')")
            if not box or not rel:
                return
            target = (box['x'] + rel['x'], box['y'] + rel['y'])
            frame, timeline = base.write_move(page, frames, frame, 14, timeline, cues, pos, target)
            pos = target
            hold(4)
            page.evaluate(f"window.__surfer.clickNode('{node_id}')")
            base.set_cursor(page, pos, True)
            base.capture(page, frames / f'{frame:06d}.png', timeline, cues, pos, True)
            frame += 1
            timeline = frame / FPS
            base.set_cursor(page, pos)

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)

            if index == 0:
                # Segment 1: intro over the idle graph, then run the iteration
                hold(round(seconds * FPS * 0.52))
                page.evaluate('window.__surfer.run(60)')
            elif index == 1:
                # Segment 2: step the trail, then add a link typing -> yahoo and re-run
                page.evaluate('window.__surfer.step(1)')
                hold(round(seconds * FPS * 0.16))
                page.evaluate('window.__surfer.step(1)')
                hold(round(seconds * FPS * 0.16))
                click_canvas_node('typing')
                hold(round(seconds * FPS * 0.12))
                click_canvas_node('yahoo')
                hold(round(seconds * FPS * 0.14))
                page.evaluate('window.__surfer.run(60)')
            elif index == 2:
                # Segment 3: the damping knob — converge, break it at d = 1, restore
                click('.nav-tab[data-tab="tab-d85"]')
                hold(round(seconds * FPS * 0.10))
                click('#runPowBtn')
                hold(round(seconds * FPS * 0.30))
                click('#showdownBtn')
                hold(round(seconds * FPS * 0.30))
                page.evaluate('window.__surfer.setD(0.85)')
            elif index == 3:
                # Segment 4: the index — googol single hit, k1 to zero and back
                click('.nav-tab[data-tab="tab-index"]')
                hold(round(seconds * FPS * 0.14))
                click('#queryPresets button[data-q="googol"]')
                hold(round(seconds * FPS * 0.30))
                page.evaluate('window.__surfer.setK1(0)')
                hold(round(seconds * FPS * 0.22))
                page.evaluate('window.__surfer.setK1(1.2)')
            elif index == 4:
                # Segment 5: the blend, then the failed search that named a company
                click('.nav-tab[data-tab="tab-1998"]')
                hold(round(seconds * FPS * 0.06))
                page.evaluate('window.__surfer.setAlpha(0)')
                hold(round(seconds * FPS * 0.12))
                page.evaluate('window.__surfer.setAlpha(1)')
                hold(round(seconds * FPS * 0.12))
                page.evaluate('window.__surfer.setAlpha(0.35)')
                hold(round(seconds * FPS * 0.12))
                click('#q4Presets button[data-q="google"]')
                hold(round(seconds * FPS * 0.30))
                click('.retro-empty .dym a')
            hold(round(end * FPS) - frame)

        browser.close()
    return frames
