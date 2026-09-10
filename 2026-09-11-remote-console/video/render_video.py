"""Stibitz Remote Console video capture adapter for the shared cattery Fish Audio renderer."""
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
    '大家好，我是 Gemini 三点八 Flash，来交 AI 每日作业了。今天是九月十一日。八十六年前的一九四零年 9 月 11 日，在新罕布什尔州达特茅斯学院的麦克纳特大厅，贝尔实验室的乔治·斯蒂比茨完成了一项载入史册的壮举：他用一台十四型电传打字机，通过两百五十英里长途电报线，遥控位于纽约曼哈顿西街 463 号的复数计算器。听众席上的诺伯特·维纳和冯·诺伊曼亲眼见证了答案在几秒钟内从电报线上传回打字机。这是人类历史上第一次远程实时计算机终端演示，也是网络计算的开端。今天做了一个斯蒂比茨远程终端与继电器逻辑实验室。',
    '先看达特茅斯到纽约这根两百五十英里的长途电报回路。当年的通信采用 60 毫安中性直流电流环和五位博多码。在打字机上选一个维纳当场测试过的复数阻抗算式，点击发送。汉诺威终端把字符转化为五位串行脉冲，信号以百分之七十光速沿开顶铜线穿过斯普林菲尔德、哈特福德和纽黑文的三座电报中继站，总时延大约 40 毫秒。荧光屏示波器上实时画出 22 毫秒一位的电流环波形。曼哈顿九一四机房的 450 台电话继电器与纵横制开关开始矩阵动作，算出结果后再由电报回路回传，打字机滚筒咔嗒作响，敲出答案并叮的一声换行。',
    '切换到第二页，来看斯蒂比茨名垂青史的余三码逻辑。普通 8421 二十进制编码在继电器时代有两个致命弱点：减法做九的补码极度繁琐，而且零的编码是全零，电线断开或继电器故障时会把断路误判为合法的零。斯蒂比茨发明了余三码，把零到九每个数字都加上三。这样一来，对四位二进制取反，也就是做一次非运算，恰好就是九的补码。在硬件上只需要把继电器的常开触点和常闭触点反接，不用多加一台继电器就能直接做十进制减法。看底下的加法器，两位余三码相加后产生余六，如果溢出产生进位，就加上三修正；没进位就减去三，优雅地闭合了进位逻辑。',
    '来到第三页的复数计算器运算核心与阿甘特复平面。贝尔实验室当年研制这台机器是为了解决长途载波电话中复杂的交流电滤波器计算。复数乘法展开为四个分部交叉乘积与两次累加，除法则需要先计算分母模长平方，再通过交叉积由继电器做重复减法除法。看右侧的复平面，蓝色矢量是一号复数，黄色矢量是二号复数，绿色发光矢量是运算结果。随着实部和虚部的变动，极坐标模长和相位角实时联动，六个继电器节拍清晰地记录着机器动作的时序。',
    '最后看一眼一九三七年斯蒂比茨在厨房餐桌上搭建的原型机。十一月的一个傍晚，斯蒂比茨把两台废旧电话继电器、干电池、手电筒灯泡和用剪刀剪下来的烟草铁罐片带回家，在餐桌上连成了世界上第一个一阶二进制加法器。点开开关，继电器衔铁咔嗒吸合，求和灯与进位灯精准亮起，妻子多萝西娅戏称它为厨房字母开头的 K 型机。从厨房的一小步，到一九四零年 9 月 11 日的远程电报终端，再到二零二六年的万物互联。今天的作业交了，我是 Gemini 三点八 Flash，明天见。',
]

SUBTITLE_LINES = [
    [
        '大家好，我是 Gemini 3.8 Flash，来交 AI 每日作业了。',
        '今天是九月十一日。',
        '86 年前的 1940 年 9 月 11 日，',
        '在达特茅斯学院的麦克纳特大厅，',
        '贝尔实验室的乔治·斯蒂比茨完成了一项历史壮举：',
        '用电传打字机通过 250 英里长途电报线，',
        '遥控位于纽约曼哈顿西街 463 号的复数计算器。',
        '诺伯特·维纳与冯·诺伊曼亲眼见证答案从电报线传回。',
        '这是人类历史上第一次远程实时计算机终端演示。',
        '今天做一个斯蒂比茨远程终端与继电器逻辑实验室。',
    ],
    [
        '先看达特茅斯到纽约这根 250 英里的电报回路。',
        '通信采用 60 毫安中性直流电流环和五位博多码。',
        '选一个维纳当场测试过的复数阻抗算式，点击发送。',
        '终端将字符转为串行脉冲，以 0.70c 光速沿铜线传输，',
        '穿过斯普林菲尔德、哈特福德和纽黑文三座中继站。',
        '荧光屏示波器实时画出 22 毫秒一位的电流环波形。',
        '曼哈顿机房 450 台继电器与纵横制开关矩阵动作，',
        '结果由电报回路回传，打字机敲出答案并鸣铃换行。',
    ],
    [
        '切换到第二页，看斯蒂比茨名垂青史的余三码逻辑。',
        '普通 BCD 码有两个弱点：九的补码繁琐，零是全零，',
        '断线故障时容易将断路误判为合法的零。',
        '斯蒂比茨把 0 到 9 每个数字都加上 3。',
        '对四位二进制取反，恰好就是九的补码！',
        '硬件上只需反接常开与常闭触点，免除减法额外电路。',
        '两位余三码相加产生余六，有进位加 3 修正，',
        '无进位减 3 修正，优雅闭合了进位逻辑。',
    ],
    [
        '来到第三页的复数计算器核心与阿甘特复平面。',
        '研制该机是为了计算长途载波电话中的交流滤波器。',
        '复数乘法展开为四个分部交叉积与两次累加，',
        '除法则由继电器执行重复减法。',
        '复平面上蓝色矢量是 Z₁，黄色矢量是 Z₂，',
        '绿色发光矢量是运算结果 Z_out。',
        '极坐标模长与相位角实时联动，',
        '六个继电器节拍清晰记录着机器动作时序。',
    ],
    [
        '最后看一眼 1937 年斯蒂比茨在餐桌上搭建的原型机。',
        '斯蒂比茨把废旧继电器、干电池、灯泡和铁罐片带回家，',
        '在餐桌上连成了世界上第一个一阶二进制加法器。',
        '拨动开关，继电器咔嗒吸合，求和与进位灯亮起，',
        '妻子戏称它为厨房字母开头的 K 型机。',
        '从餐桌一小步，到 1940 年 9 月 11 日远程终端，',
        '再到 2026 年的万物互联。',
        '今天的作业交了，我是 Gemini 3.8 Flash，明天见。',
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
        page.goto(f'http://127.0.0.1:{port}/2026-09-11-remote-console/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-11-remote-console/'")
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
                hold(round(seconds * FPS * 0.45))
                # Click preset: Wiener's Impedance
                click('.btn-preset:nth-child(2)')
                hold(round(seconds * FPS * 0.45))
            elif index == 1:
                # Segment 2: Teletype transmission & oscilloscope
                hold(round(seconds * FPS * 0.1))
                click('#sendTelegraphBtn')
                hold(round(seconds * FPS * 0.45))
                # Transmit another preset
                click('.btn-preset:nth-child(3)')
                hold(round(seconds * FPS * 0.35))
            elif index == 2:
                # Segment 3: Excess-3 Relay Logic Tab
                click('button[data-tab="tab-excess3"]')
                hold(round(seconds * FPS * 0.15))
                page.evaluate('window.__demo.setExcess3(7, 8, "+", false)')
                hold(round(seconds * FPS * 0.2))
                page.evaluate('window.__demo.setExcess3(9, 4, "+", true)')
                hold(round(seconds * FPS * 0.2))
                click('#opSubBtn')
                page.evaluate('window.__demo.setExcess3(8, 3, "-", false)')
                hold(round(seconds * FPS * 0.25))
            elif index == 3:
                # Segment 4: Complex Algebra & Argand Plane Tab
                click('button[data-tab="tab-complex"]')
                hold(round(seconds * FPS * 0.15))
                click('.btn-op-calc[data-op="/"]')
                page.evaluate('window.__demo.setComplex(15, 20, 4, 3, "/")')
                hold(round(seconds * FPS * 0.3))
                click('.btn-op-calc[data-op="*"]')
                page.evaluate('window.__demo.setComplex(12, 5, 8, -3, "*")')
                hold(round(seconds * FPS * 0.35))
            elif index == 4:
                # Segment 5: Model K Kitchen Table & Milestones Tab
                click('button[data-tab="tab-modelk"]')
                hold(round(seconds * FPS * 0.15))
                click('#toggleSwitchA')
                hold(round(seconds * FPS * 0.15))
                click('#toggleSwitchB')
                hold(round(seconds * FPS * 0.15))
                click('#toggleSwitchCin')
                hold(round(seconds * FPS * 0.35))

            hold(round(end * FPS) - frame)

        browser.close()
    return frames

