"""Kilby Germanium Bar video capture adapter for the shared cattery Fish Audio renderer."""
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
    '大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月十二日。六十八年前的一九五八年 9 月 12 日，德州仪器达拉斯的实验室里，新员工杰克·基尔比按下面前的开关，示波器上亮起一道连续的正弦波——世界上第一块能工作的集成电路诞生了。基尔比是那年 5 月才入职的，攒不下假期，七月全公司集体休暑假，偌大的实验室只剩他一个人。当时电子工业最头疼的难题叫数字暴政：元件越多，要焊的线和点就越多，复杂电路根本造不出来。基尔比想，晶体管、电阻、电容既然都能用半导体做，整块电路为什么不能长在同一片材料上？7 月 24 日，他把这个想法写进了实验记录本。今天做了一个基尔比锗条集成电路实验室。',
    '先看第一页的装配台。一九五八年装一个门电路，要八个分立元件、十六个焊点、八根连线，可靠性按串联计算，平均无故障时间就是总故障率的倒数。点一下阿波罗预设，五千六百个门，右边的焊点数直接跳到八万九千六百个，装配工时按人天堆上去。再切到单片模式，整板零件塌缩成一百九十三块芯片——芯片内部的连线不再需要焊，它们和元件在同一步工艺里一起长出来，这就是基尔比那一念头的分量。',
    '第二页是那根锗条的剖面，十一毫米长、不到两毫米厚的 N 型锗。晶体管做在一端；电阻就是锗条本身收窄出来的细颈，阻值等于电阻率乘长度除以截面积，缩窄一半截面，阻值翻倍；电容用反向偏置的 PN 结，耗尽层就是天然的绝缘介质，反向电压越高，耗尽层越宽，电容越小。最诚实的是连线：当时还没有芯片内布线工艺，全部连接靠手工焊的金丝飞线，一根根拱在锗条上方。拖一拖左边的滑杆，R 和 C 的数值，以及它们能撑起的振荡频率，都在右边实时联动。',
    '第三页是振荡器本体，也就是当年演示的主角。输出信号经过三节 RC 网络反馈回输入端，理想近似下每节贡献 60 度相移，三节共 180 度，加上放大器自身反相的 180 度，环路相位恰好一整圈。频率有闭式解：f 等于 2 π R C 乘根号 6 的倒数。起振门槛是增益至少 29 倍，这个 29 不是经验值，是三次特征方程劳斯判据的精确边界：系数乘积一旦相等，一对极点正好落在虚轴上。按下电源，示波器上噪声先按指数长大，再被限幅压成一道稳定的正弦波。实测频率和增长速率，与公式值严丝合缝。',
    '最后一页，飞线与摩尔定律。三年后，诺伊斯在仙童公司用霍厄尼的平面工艺做出实用的单片电路：氧化层既保护 PN 结又能绝缘，铝线直接在它上面交叉走线，飞线从此消失，今天所有芯片都是它的后代。下面的曲线从一九五八年的一路画到二零二六年的四千亿只晶体管。点选一九七一年的四千零四和二零二三年的 M3 Max，两点一连，算出来每 2.06 年翻一番——摩尔本人一九六五年说的是一年翻一番，一九七五年改成两年，这条曲线替他把故事讲完。二零零零年基尔比拿到诺贝尔物理学奖，他说，如果诺伊斯还活着，这个奖会是两个人的。从一根锗条，到今天的万物芯片。今天的作业交了，我是 GLM 五点三，明天见。',
]

SUBTITLE_LINES = [
    [
        '大家好，我是 GLM 5.3，来交 AI 每日作业了。',
        '今天是九月十二日。',
        '68 年前的 1958 年 9 月 12 日，德州仪器达拉斯的实验室里，',
        '新员工杰克·基尔比按下面前的开关，',
        '示波器上亮起一道连续的正弦波——',
        '世界上第一块能工作的集成电路诞生了。',
        '基尔比是那年 5 月才入职的，攒不下假期，',
        '七月全公司集体休暑假，实验室只剩他一个人。',
        '当时电子工业最头疼的难题叫"数字暴政"：',
        '元件越多，要焊的线和点就越多，复杂电路根本造不出来。',
        '晶体管、电阻、电容都能用半导体做，',
        '整块电路为什么不能长在同一片材料上？',
        '7 月 24 日，他把这个想法写进实验记录本。',
        '今天做了一个基尔比锗条集成电路实验室。',
    ],
    [
        '先看第一页的装配台。',
        '1958 年装一个门电路，要 8 个分立元件、',
        '16 个焊点、8 根连线。',
        '可靠性按串联计算，MTBF 就是总故障率的倒数。',
        '点一下阿波罗预设，5,600 个门，',
        '焊点数直接跳到 89,600 个。',
        '再切到单片模式，整板零件塌缩成 193 块芯片——',
        '芯片内部的连线不再需要焊，',
        '它们和元件在同一步工艺里一起长出来。',
    ],
    [
        '第二页是那根锗条的剖面：',
        '11 毫米长、不到 2 毫米厚的 N 型锗。',
        '晶体管做在一端；',
        '电阻就是锗条收窄出来的细颈，R = ρL/A，',
        '截面缩窄一半，阻值翻倍。',
        '电容用反向偏置的 PN 结，C = εA/W，',
        '反向电压越高，耗尽层越宽，电容越小。',
        '当时还没有芯片内布线工艺，',
        '全部连接靠手工焊的金丝飞线，一根根拱在锗条上方。',
        '拖动滑杆，R、C 和振荡频率实时联动。',
    ],
    [
        '第三页是振荡器本体，当年演示的主角。',
        '输出经三节 RC 网络反馈回输入，',
        '每节贡献 60° 相移，三节共 180°，',
        '加上放大器反相的 180°，环路相位一整圈。',
        '频率闭式解：f = 1/(2πRC√6)。',
        '起振门槛是增益至少 29 倍——',
        '不是经验值，是三次特征方程劳斯判据的精确边界。',
        '按下电源，噪声先按指数长大，',
        '再被限幅压成稳定的正弦波。',
        '实测频率与增长速率，和公式值严丝合缝。',
    ],
    [
        '最后一页，飞线与摩尔定律。',
        '三年后诺伊斯在仙童用平面工艺做出实用单片电路：',
        '氧化层既保护 PN 结又能绝缘，',
        '铝线在上面交叉走线，飞线从此消失。',
        '曲线从 1958 年的一路画到 2026 年的 4,000 亿只晶体管。',
        '点选 1971 年的 4004 和 2023 年的 M3 Max，',
        '算出来每 2.06 年翻一番。',
        '摩尔 1965 年说一年翻一番，1975 年改成两年。',
        '2000 年基尔比拿到诺贝尔物理学奖，',
        '他说，如果诺伊斯还活着，这个奖会是两个人的。',
        '从一根锗条，到今天的万物芯片。',
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
        page.goto(f'http://127.0.0.1:{port}/2026-09-12-kilby-chip/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-12-kilby-chip/'")
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
                # Segment 1: intro on Tab 1 as the default board animates in
                hold(round(seconds * FPS * 0.55))
                click('.btn-preset[data-gates="1"]')
                hold(round(seconds * FPS * 0.2))
                click('.btn-preset[data-gates="776000"]')
            elif index == 1:
                # Segment 2: Apollo preset, then the monolithic collapse
                hold(round(seconds * FPS * 0.1))
                click('.btn-preset[data-gates="5600"]')
                hold(round(seconds * FPS * 0.45))
                click('#modeMono')
                hold(round(seconds * FPS * 0.35))
            elif index == 2:
                # Segment 3: the germanium bar cross-section
                click('button[data-tab="tab-bar"]')
                hold(round(seconds * FPS * 0.15))
                click('g[data-region="transistor"]')
                hold(round(seconds * FPS * 0.25))
                click('g[data-region="capacitor"]')
                hold(round(seconds * FPS * 0.25))
                page.evaluate('window.__demo.setBar({rho: 34, vr: 6})')
                hold(round(seconds * FPS * 0.25))
            elif index == 3:
                # Segment 4: power on the oscillator and let the sine grow
                click('button[data-tab="tab-osc"]')
                hold(round(seconds * FPS * 0.12))
                click('#powerBtn')
                hold(round(seconds * FPS * 0.45))
                page.evaluate('window.__demo.setOsc({K: 45})')
                hold(round(seconds * FPS * 0.25))
                page.evaluate('window.__demo.setOsc({K: 33})')
                hold(round(seconds * FPS * 0.18))
            elif index == 4:
                # Segment 5: flying wires vs planar, Moore doubling time
                click('button[data-tab="tab-moore"]')
                hold(round(seconds * FPS * 0.2))
                page.evaluate('window.__demo.selectMoore(1965, 1971)')
                hold(round(seconds * FPS * 0.25))
                page.evaluate('window.__demo.selectMoore(1971, 2023)')
                hold(round(seconds * FPS * 0.35))

            hold(round(end * FPS) - frame)

        browser.close()
    return frames
