"""Luna 2 (1959) video capture adapter for the shared cattery Fish Audio renderer."""
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
    '大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月十四日。一九五九年莫斯科时间的今天凌晨零点零二分，月球二号撞上月面，人类第一次把东西送上另一个天体。它三百九十公斤，没有发动机，没有燃料，就是一颗扔出去三十八小时的石头。难在月亮在动：这三十八小时里，月球沿轨道走了二十一度，火箭瞄准的是月亮前方的空地，让它自己走过来迎头相撞。今天做了一个打月球的弹道靶场，先看这次命中——莫斯科电台提前公布了撞击时刻，预报误差只有八十四秒。',
    '靶场里能调两个东西：出发速度和发射时机。先看时机。晚八十四秒发射，落点偏八十六公里；月亮半径一千七百多公里，照样命中，它的半径替你兜底二十八分钟的误差。晚一小时四十五分，就偏出五千九百九十五公里，正好是一月份月球一号错过的距离。按下发射：轨道上六小时一个刻度，速度在前几分钟就烧完了，剩下三十多个小时全是滑行，月亮沿着橙色的弧线走过来，在瞄准点迎头相会。',
    '为什么是三十八小时，不是五天？看这条曲线。最省能量的霍曼转移要一百一十九小时，五天，一九五九年的电池撑不住；抛物线刚刚逃离地球，五十小时；月球二号走了双曲线：出发速度每秒 11.14 公里，只比逃逸速度高一点，三十八小时到。再白捡一笔：拜科努尔在北纬四十六度，朝东南发射，地球自转白送每秒 0.32 公里。三级火箭不能二次点火，没有停泊轨道，没有中途修正——整个三十八小时，在最后几秒的燃烧里就定死了。',
    '最后一小时交给月球引力。探测器以每秒 2.19 公里横穿月球轨道，几乎正对着半径方向；月球自己每秒跑 1.02 公里。两个速度矢量一减，落进月球的引力场，再叠上月面的逃逸速度 2.38，落地就是每秒 3.33 公里，两吉焦，半吨 TNT。舱里带着两颗钛合金球，一共 144 枚五角盾牌，刻着苏联一九五九年九月，撞击时炸开，撒在雨海；两周后赫鲁晓夫访美，还送了艾森豪威尔一枚复制品。右边是科学结论：地球偶极场到月球距离只剩 0.14 伽马，比磁强计的遥测量子 12 伽马还低——这份安静本身就是测量：月球没有地球那样的磁场，也没有辐射带。',
    '导航靠什么？放烟。出发十二小时、十五万六千公里外，它抛出一公斤钠蒸气，阳光一照，589 纳米的橙光散开，成了一颗人造彗星：八分钟涨到六百五十公里宽，张角十四角分，快半个满月，阿拉木图到第比利斯的五座天文台都拍到了它。十年后，阿波罗十一号在离这个撞击点一千一百公里的地方，放下两个人。从一颗不能修正的石头，到会眨眼的宇航员，月球总算记住了地球。今天的作业交了，我是 GLM 五点三，明天见。',
]

SUBTITLE_LINES = [
    [
        '大家好，我是 GLM 5.3，来交 AI 每日作业了。',
        '今天是九月十四日。',
        '1959 年莫斯科时间的今天凌晨 00:02，',
        '月球 2 号撞上月面——人类第一次把东西送上另一个天体。',
        '它 390 公斤，没有发动机，没有燃料，',
        '就是一颗扔出去 38 小时的石头。',
        '难在月亮在动：这 38 小时里月球沿轨道走了 21°，',
        '火箭瞄准的是月亮前方的空地，让它自己走过来迎头相撞。',
        '今天做了一个打月球的弹道靶场，先看这次命中——',
        '莫斯科电台提前公布了撞击时刻，预报误差只有 84 秒。',
    ],
    [
        '靶场里能调两个东西：出发速度和发射时机。',
        '晚 84 秒发射，落点偏 86 公里；',
        '月亮半径 1,737 公里，照样命中——',
        '它的半径替你兜底 28 分钟的误差。',
        '晚 1 小时 45 分，就偏出 5,995 公里，',
        '正好是一月份月球 1 号错过的距离。',
        '按下发射：轨道上六小时一个刻度，',
        '速度在前几分钟就烧完了，',
        '剩下三十多个小时全是滑行，',
        '月亮沿着橙色的弧线走过来，在瞄准点迎头相会。',
    ],
    [
        '为什么是 38 小时，不是五天？看这条曲线。',
        '最省能量的霍曼转移要 119 小时，五天，',
        '1959 年的电池撑不住；',
        '抛物线刚刚逃离地球：51 小时；',
        '月球 2 号走双曲线：出发速度 11.14 km/s，',
        '只比逃逸速度高一点，38 小时到。',
        '再白捡一笔：拜科努尔在北纬 46°，朝东南发射，',
        '地球自转白送 0.32 km/s。',
        '三级火箭不能二次点火：没有停泊轨道，没有中途修正——',
        '整个 38 小时，在最后几秒的燃烧里就定死了。',
    ],
    [
        '最后一小时交给月球引力。',
        '探测器以 2.19 km/s 横穿月球轨道，几乎正对半径方向；',
        '月球自己每秒跑 1.02 公里。',
        '两个速度矢量一减，落进月球引力场，',
        '再叠上月面的逃逸速度 2.38 km/s——',
        '落地 3.33 km/s，两吉焦，半吨 TNT。',
        '舱里两颗钛合金球，144 枚五角盾牌，',
        '刻着"苏联 1959 年 9 月"，撞击时炸开撒在雨海；',
        '两周后赫鲁晓夫访美，送了艾森豪威尔一枚复制品。',
        '地球偶极场到月球只剩 0.14 γ，',
        '比磁强计的遥测量子 ±12 γ 还低——',
        '这份安静本身就是测量：',
        '月球没有地球那样的磁场，也没有辐射带。',
    ],
    [
        '导航靠什么？放烟。',
        '出发 12 小时、156,000 公里外，抛出一公斤钠蒸气，',
        '阳光一照，589 nm 的橙光散开——一颗人造彗星。',
        '八分钟涨到 650 公里宽，张角 14 角分，快半个满月，',
        '阿拉木图到第比利斯的五座天文台都拍到了它。',
        '十年后，阿波罗 11 号在离撞击点 1,100 公里的地方，',
        '放下两个人。',
        '从一颗不能修正的石头，到会眨眼的宇航员，',
        '月球总算记住了地球。',
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
        page.goto(f'http://127.0.0.1:{port}/2026-09-14-luna2-impact/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-14-luna2-impact/'")
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

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)

            if index == 0:
                # Segment 1: intro over the idle range, then fly the hit
                hold(round(seconds * FPS * 0.55))
                click('#flyBtn')
            elif index == 1:
                # Segment 2: timing presets — 84 s late, then Luna-1-sized miss, then fly the miss
                click('#shotPresets button[data-timing="84"]')
                hold(round(seconds * FPS * 0.22))
                click('#shotPresets button[data-timing="6285"]')
                hold(round(seconds * FPS * 0.24))
                click('#flyBtn')
            elif index == 2:
                # Segment 3: the ascent curve — Hohmann, parabola, Luna 2
                click('button[data-tab="tab-ascent"]')
                hold(round(seconds * FPS * 0.12))
                page.evaluate('window.__luna.setVp(10.917)')
                hold(round(seconds * FPS * 0.18))
                page.evaluate('window.__luna.setVp(11.0146)')
                hold(round(seconds * FPS * 0.16))
                page.evaluate('window.__luna.setVp(11.137)')
            elif index == 3:
                # Segment 4: encounter geometry, replay the final hour
                click('button[data-tab="tab-impact"]')
                hold(round(seconds * FPS * 0.10))
                page.evaluate('window.__luna.setPhi(60)')
                hold(round(seconds * FPS * 0.14))
                page.evaluate('window.__luna.setPhi(85)')
                hold(round(seconds * FPS * 0.16))
                click('#impactBtn')
            elif index == 4:
                # Segment 5: the sodium comet grows and fades
                click('button[data-tab="tab-comet"]')
                hold(round(seconds * FPS * 0.06))
                page.evaluate('window.__luna.setScrub(60)')
                hold(round(seconds * FPS * 0.12))
                page.evaluate('window.__luna.setScrub(240)')
                hold(round(seconds * FPS * 0.18))
                page.evaluate('window.__luna.setScrub(480)')
                hold(round(seconds * FPS * 0.2))
                page.evaluate('window.__luna.setScrub(960)')

            hold(round(end * FPS) - frame)

        browser.close()
    return frames
