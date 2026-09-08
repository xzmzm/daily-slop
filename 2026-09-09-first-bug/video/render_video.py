"""First Bug capture adapter for the shared cattery Fish Audio renderer."""
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
    '大家好，我是 Gemini 三点八 Flash，来交 AI 每日作业了。今天是九月九日。七十九年前的一九四七年 9 月 9 日下午 15 点 45 分，哈佛大学二号继电器计算机停机了。操作员从机柜 F 的 70 号继电器触点里，用镊子夹出一只两英寸长的飞蛾。格蕾丝·霍珀把它贴在运行日志上，写下了一句著名的话：“发现 bug 的第一个真实案例”。今天做了一个哈佛 Mark II 继电器计算机实验室。',
    '点开 70 号继电器剖面。线圈通上 50 伏直流电，磁力把钢制衔铁吸过来，带动上面的银触点下压。正常情况下，触点碰撞反弹几次后咬合，电阻只有零点零二欧姆。但那只飞蛾正好卡在两个触点中间。它的身体厚度有零点三八毫米，而且是绝缘体。衔铁还没碰到下触点就被卡住了，电阻超过一亿欧姆，电路永远断开。点一下用镊子取出飞蛾，触点立刻清脆地闭合。',
    '切到机柜 F。这是一组八位的累加器，64 到 71 号继电器分别对应 0 到 7 位。70 号继电器管的是第六位，权重是 64。哈佛 Mark II 设计了硬件双重校验电路。算一道 65 加 10，正确结果是 75。但因为 70 号继电器卡了一只飞蛾，第六位始终是 0，算出来的数字变成 11，差了整整 64。校验电路立刻鸣笛报警，整台机器自动停机。',
    '在晶体管和芯片出现之前，计算机就是用这些开关算出来的。常闭触点通电就断开，做成了非门；两个触点串联是与门；并联是或门；双掷触点交叉换向，构成了异或门。这几个继电器连在一起，电流顺着黄铜触点一路跑过去，就组成了一位全加器。开关闭合，灯泡点亮，这就是早期计算机的物理脉搏。',
    '最后看一眼一九四七年 9 月 9 日的日志原件。黄色的透明胶带底下，压着那只真正的飞蛾标本。其实早在十九世纪，电报工人和爱迪生就把难以捉摸的故障叫 bug 了。但八十年前的那张日志，第一次把 bug 变成了计算机史上的实体。今天的作业交了，我是 Gemini 三点八 Flash，明天见。',
]

SUBTITLE_LINES = [
    [
        '大家好，我是 Gemini 3.8 Flash，来交 AI 每日作业了。',
        '今天是九月九日。',
        '79 年前的一九四七年 9 月 9 日下午 15 点 45 分，',
        '哈佛 Mark II 继电器计算机停机了。',
        '操作员从机柜 F 的 70 号继电器里，',
        '用镊子夹出一只两英寸长的飞蛾。',
        '格蕾丝·霍珀把它贴在运行日志上，',
        '写下：“发现 bug 的第一个真实案例”。',
        '今天做一个哈佛 Mark II 继电器实验室。',
    ],
    [
        '点开 70 号继电器剖面。',
        '线圈通上 50 伏直流电，',
        '磁力把钢制衔铁吸过来，',
        '银触点下压咬合，电阻只有 0.02 欧姆。',
        '但那只飞蛾正好卡在触点中间。',
        '身体厚度 0.38 毫米，而且是绝缘体。',
        '衔铁被提前挡住，电阻超过一亿欧姆。',
        '点一下用镊子夹出飞蛾，',
        '触点立刻清脆地闭合。',
    ],
    [
        '切到机柜 F。',
        '这是由继电器组成的八位累加器。',
        '70 号继电器管第六位，权重是 64。',
        'Mark II 设计了硬件双重校验。',
        '算一道 65 加 10，本该是 75。',
        '但 70 号继电器被飞蛾卡住，',
        '第六位读出 0，算出来变成了 11。',
        '差了 64，校验电路鸣笛报警，机器停机。',
    ],
    [
        '在晶体管出现之前，',
        '计算机就是用这些开关算出来的。',
        '常闭触点是“非门”，串联是“与门”，',
        '并联是“或门”，双掷换向是“异或门”。',
        '继电器连在一起，',
        '电流顺着黄铜触点流动，',
        '就组成了全加器。',
        '开关闭合，灯泡点亮，',
        '这就是早期计算机的物理脉搏。',
    ],
    [
        '看一眼 1947 年 9 月 9 日的日志原件。',
        '黄色胶带底下，压着那只真正的飞蛾。',
        '早在十九世纪，爱迪生就把机械故障叫 bug 了。',
        '但 1947 年的这张日志，',
        '第一次让 bug 在计算机历史上留下了物理实体。',
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
        page.goto(f'http://127.0.0.1:{port}/2026-09-09-first-bug/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-09-first-bug/'")
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
                # Introduction on Bench view
                hold(round(seconds * FPS * 0.4))
                click('#btn-power-coil')
                hold(round(seconds * FPS * 0.3))
            elif index == 1:
                # Segment 2: Detail on contact & extract moth
                hold(round(seconds * FPS * 0.4))
                click('#btn-toggle-moth') # Extract moth
                hold(round(seconds * FPS * 0.3))
                click('#btn-power-coil') # Power again cleanly
            elif index == 2:
                # Segment 3: Panel F Rack
                click('button[data-tab="rack"]')
                hold(round(seconds * FPS * 0.3))
                click('#btn-clock-step')
                hold(round(seconds * FPS * 0.3))
            elif index == 3:
                # Segment 4: Logic Gates
                click('button[data-tab="logic"]')
                hold(round(seconds * FPS * 0.3))
                # Toggle an input in adder
                click('.switch-toggle-btn:nth-child(2)')
                hold(round(seconds * FPS * 0.3))
            elif index == 4:
                # Segment 5: Logbook & Timeline
                click('button[data-tab="logbook"]')
                hold(round(seconds * FPS * 0.5))
                page.evaluate('window.scrollTo(0, document.body.scrollHeight / 3)')

            hold(round(end * FPS) - frame)

        browser.close()
    return frames
