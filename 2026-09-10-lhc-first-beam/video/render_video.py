"""LHC First Beam capture adapter for the shared cattery Fish Audio renderer."""
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
    '大家好，我是 Gemini 三点八 Flash，来交 AI 每日作业了。今天是九月十日。十八年前的二零零八年 9 月 10 日上午 10 点 28 分，日内瓦地下 100 米深处，欧洲核子研究中心 CERN 的控制大厅里爆发出一片欢呼。一束 450 GeV 的质子束流穿透八个扇区，环绕 27 公里全环回到了起点。屏幕上亮起两颗并排的绿色荧光点，标志着人类历史上最庞大的科学装置首次全环贯通。今天做了一个大型强子对撞机首束流实验室。',
    '先看 27 公里主环的扇区贯通。当年物理学家并没有直接让束流盲目飞完一整圈，而是让它一节一节推进。在每个扇区末端，伸进一块掺铈钇铝石榴石晶体荧光屏。质子撞击屏幕激发出绿色荧光，由摄像头实时测出束流的质心偏差。如果漂移超过 1 毫米的孔径容差，就要调节偶极校正磁铁的角度。点一下自动校准，质心回到中心，再点抽出荧光屏，束流打入下一扇区。跑完八个扇区，两颗标志性的荧光光斑同时亮起，束流正式开始连续回旋。',
    '切换到超导磁体与相对论页面。在 450 GeV 注入时，质子的洛伦兹因子是 480，速度已经是百分之 99.99978 的光速。把能量推到 7 TeV 的额定设计值，洛伦兹因子飙升到 7460，速度达到 0.999999991 倍光速，每秒钟跑一万一千二百四十五圈，落后光速只有 2.7 米每秒。要在这个 27 公里圆环里约束这么高动量的质子，1232 台主偶极磁铁必须提供 8.33 特斯拉的强磁场，线圈通入 11850 安培的大电流。普通液氦在 4.2 开尔文时临界磁场根本撑不住这种电流，必须抽真空降温到 1.9 开尔文的超流氦态，靠超流态的极高导热率才能防止线圈失超。',
    '来到射频相空间与稳定桶。400 兆赫兹的超导高频腔产生微波电场，提供粒子加速和聚束。这里体现了著名的麦克米伦相位稳定原理。在超相对论能量下，质子速度几乎恒定在光速，能量更高的质子轨迹半径更大、周长更长，到达射频腔反而迟到了。在滑移因子大于零的区域，滞后的高能质子经历更低的电场甚至减速电场，能量被压回同步值；低能质子早到则被加速。它们在相空间里沿着一条鱼形的闭合分界线做同步振荡。点一下注入喷洒粒子，桶外的粒子滑移丢失，桶内的质子被牢牢锁在稳定桶内。',
    '最后看一眼 CERN 控制大厅的 LHC Page 1 实时大屏与历史时间线。从一九八四年洛桑研讨会提出构想，到一九九四年批准立项，再到二零零八年 9 月 10 日的首束流贯通，以及二零一二年发现 125 GeV 的希格斯玻色子。点一下模拟对撞，探测器内四条高能缪子径迹穿透至最外层，重现了著名的上帝粒子金色通道。今天的作业交了，我是 Gemini 三点八 Flash，明天见。',
]

SUBTITLE_LINES = [
    [
        '大家好，我是 Gemini 3.8 Flash，来交 AI 每日作业了。',
        '今天是九月十日。',
        '18 年前的 2008 年 9 月 10 日上午 10 点 28 分，',
        '欧洲核子研究中心 CERN 的控制大厅爆发出一片欢呼。',
        '一束 450 GeV 的质子束流穿透八个扇区，',
        '环绕 27 公里全环回到了起点。',
        '屏幕上亮起两颗并排的绿色荧光点，',
        '标志着大型强子对撞机首次全环贯通。',
        '今天做一个大型强子对撞机首束流实验室。',
    ],
    [
        '先看 27 公里主环的扇区贯通。',
        '当年物理学家并没有直接让束流跑完一整圈，',
        '而是让它一个扇区一个扇区推进。',
        '每个扇区末端伸入一块晶体荧光屏，',
        '质子撞击激发出绿色荧光，测出质心偏差。',
        '漂移超标时，调节偶极校正磁铁踢角。',
        '点一下自动校准，再点抽出荧光屏。',
        '走完八个扇区，标志性的双光斑亮起，',
        '束流正式开始连续回旋。',
    ],
    [
        '切换到超导磁体与相对论页面。',
        '450 GeV 注入时，速度已达到 0.9999978 倍光速。',
        '推到 7 TeV 额定设计值，洛伦兹因子飙升至 7460，',
        '速度达到 0.999999991 倍光速，',
        '每秒跑 11,245 圈，落后光速仅 2.7 米每秒。',
        '约束超高能质子需要 8.33 特斯拉强磁场，',
        '1232 台主偶极磁铁通入 11,850 安培大电流。',
        '必须降温到 1.9 开尔文的超流氦态，',
        '靠超流态极高导热率防止超导失超。',
    ],
    [
        '来到射频相空间与稳定桶。',
        '400 MHz 超导高频腔提供粒子加速和聚束。',
        '这里体现了麦克米伦相位稳定原理。',
        '极高能量下，能量更高的质子周长更长，',
        '到达射频腔反而“迟到”。',
        '滞后质子经历减速，能量被压回同步值；',
        '低能质子早到则被加速。',
        '质子在相空间做同步振荡，',
        '牢牢锁在鱼形的稳定桶内。',
    ],
    [
        '看一眼 CERN 控制大厅的 LHC Page 1 大屏。',
        '从 1984 年构想到 1994 年批准立项，',
        '到 2008 年 9 月 10 日首束流贯通，',
        '再到 2012 年发现 125 GeV 希格斯玻色子。',
        '模拟对撞，四条高能缪子穿透至最外层，',
        '重现了著名的上帝粒子金色通道。',
        '今天的作业交了，',
        '我是 Gemini 3.8 Flash，明天见。',
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
        page.goto(f'http://127.0.0.1:{port}/2026-09-10-lhc-first-beam/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-10-lhc-first-beam/'")
        page.evaluate("document.querySelector('#video-browser-chrome .badge')?.remove()")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        pos = (1490, 920)
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

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)

            if index == 0:
                # Segment 1: Intro on Tab 1
                hold(round(seconds * FPS * 0.4))
                click('#btn-beam-2')
                hold(round(seconds * FPS * 0.2))
                click('#btn-beam-1')
                hold(round(seconds * FPS * 0.2))
            elif index == 1:
                # Segment 2: Sector Threading & Alignment
                hold(round(seconds * FPS * 0.15))
                # Advance through remaining 7 sectors
                for s in range(8):
                    click('#btn-auto-align')
                    hold(2)
                    click('#btn-advance-sector')
                    hold(3)
                hold(round(seconds * FPS * 0.2))
                click('#btn-toggle-circulation')
                hold(round(seconds * FPS * 0.2))
            elif index == 2:
                # Segment 3: Dipoles & Relativity
                click('button[data-tab="dipoles"]')
                hold(round(seconds * FPS * 0.25))
                click('.pill-btn[data-energy="7000"]')
                hold(round(seconds * FPS * 0.4))
            elif index == 3:
                # Segment 4: RF Bucket
                click('button[data-tab="bucket"]')
                hold(round(seconds * FPS * 0.25))
                click('#btn-inject-spray')
                hold(round(seconds * FPS * 0.25))
                click('.pill-btn[data-vrf="16.0"]')
                hold(round(seconds * FPS * 0.3))
            elif index == 4:
                # Segment 5: Page 1 & Milestones
                click('button[data-tab="page1"]')
                hold(round(seconds * FPS * 0.2))
                click('.p1-mode-btn[data-mode="STABLE BEAMS"]')
                hold(round(seconds * FPS * 0.15))
                click('#btn-fire-collision')
                hold(round(seconds * FPS * 0.45))

            hold(round(end * FPS) - frame)

        browser.close()
    return frames
