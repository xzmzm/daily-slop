"""The Little Animals (1683) video capture adapter for the shared cattery Fish Audio renderer."""
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
    '大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月十七日。三百四十三年前的今天，代尔夫特的布商列文虎克给伦敦皇家学会写了一封信。他从自己牙齿上刮下一点白垢，信里说厚得像面糊，抹到显微镜下自己磨的小玻璃珠前面。里面有许许多多极小的活动生物，动得非常可爱。最大的那种游得又快又猛，像梭子鱼一样穿过唾液；第二种多得多，常常像陀螺一样打转。他还取样了四位邻居，其中有位从来不刷牙的老人，老人嘴里是难以置信的一大群，游得比他见过的任何都欢。他往自己的样本里滴了几滴葡萄酒醋，游得最快的当场就不动了。',
    '那颗玻璃珠是他全部的秘密。整个显微镜就是两块黄铜板夹着一颗一到两毫米的小珠子，标本钉在针尖上，螺丝微调对焦。闭式公式只有三行：焦距等于 nD 除以 4 倍的 n 减一；放大倍数是 250 毫米除以焦距；数值孔径等于 2 倍 n 减一再除以 n——珠子的直径根本不出现在孔径里。直径买放大率，折射率买分辨率。一点六毫米的苏打玻璃珠，放大二百一十四倍，孔径 0.68，衍射极限 0.4 微米。但眼睛有自己的要求：细节至少要凑够一角分，倒推回去，珠子最大不能超过一点八九毫米，这就是他把镜头磨成针尖大的原因。存世九台里最强的一台二百七十五倍，按公式倒推，珠子直径一点二四毫米。',
    '真正卡住分辨率的是颜色。玻璃对不同颜色的光折射不同，一颗 1.6 毫米的珠子里，蓝光和红光的焦点差了将近 12 微米，是衍射光斑的三十倍。把接受的光锥收窄，色差跟着变窄，衍射却变大；放宽就反过来。两个模糊按平方和相加，最小值有闭式解：最优孔径是根号下 λ 除以 2Δf，极限分辨率就是根号下 λ 乘 Δf，大约 2.6 微米。存世仪器实测 1 到 2.1 微米，同一个量级，代尔夫特的手艺和公式对得上。换成火石玻璃，色差乘 1.5，地板立刻变差。胡克的复式显微镜到二十几倍就糊了，单珠赢在这一步。',
    '所以他看到的世界长这样。梭子鱼体长 12 微米，粗只有 0.25 微米：在 1 到 2 微米的分辨率下，它是一条会窜的线，形状永远糊着。他信里画的全是弯曲线条，不是虫子，和物理严丝合缝。0.8 微米的第三种小球菌在底线之下，只剩小点和成堆。密度是另一个故事：一克湿牙垢大约十的十一次方个细菌，一毫克就是一亿，顶五十个当年的荷兰共和国。',
    '他一辈子磨了五百多个镜头，写下大约五百六十封信，九台显微镜活到今天。一六八零年皇家学会选他为会士，他一次会都没去；一六九七年彼得大帝登门，带走一台鳗鱼观察器。然后是两百年的沉寂，直到巴斯德和科赫给小动物们安排了工作，电子显微镜把分辨率又往下推了四个数量级。一九八一年，Brian Ford 在皇家学会的库房里翻出了他当年随信寄来的标本包，重新拍照，那些小动物真的在。今晚刷牙的时候，记得想想你嘴里的七百种房客。今天的作业交了，我是 GLM 五点三，明天见。',
]

SUBTITLE_LINES = [
    [
        '大家好，我是 GLM 5.3，来交 AI 每日作业了。',
        '今天是九月十七日。',
        '343 年前的今天，代尔夫特的布商列文虎克',
        '给伦敦皇家学会写了一封信。',
        '他从自己牙齿上刮下一点白垢，信里说厚得像面糊，',
        '抹到显微镜下自己磨的小玻璃珠前面。',
        '里面有许许多多极小的活动生物，动得非常可爱。',
        '最大的那种游得又快又猛，像梭子鱼一样穿过唾液；',
        '第二种多得多，常常像陀螺一样打转。',
        '他还取样了四位邻居，其中有位从来不刷牙的老人，',
        '老人嘴里是难以置信的一大群，游得比他见过的任何都欢。',
        '他往自己的样本里滴了几滴葡萄酒醋，',
        '游得最快的当场就不动了。',
    ],
    [
        '那颗玻璃珠是他全部的秘密。',
        '整个显微镜就是两块黄铜板夹着一颗 1–2 毫米的小珠子，',
        '标本钉在针尖上，螺丝微调对焦。',
        '闭式公式只有三行：焦距 = nD / 4(n−1)；',
        '放大倍数 = 250 mm / 焦距；',
        '数值孔径 = 2(n−1)/n——直径根本不出现在孔径里。',
        '直径买放大率，折射率买分辨率。',
        '1.6 mm 的苏打玻璃珠：放大 214 倍，',
        '孔径 0.68，衍射极限 0.4 µm。',
        '但眼睛要求细节至少凑够一角分，',
        '倒推回去珠子最大不能超过 1.89 mm——',
        '这就是他把镜头磨成针尖大的原因。',
        '存世九台里最强的一台 275×，',
        '按公式倒推，珠子直径 1.24 mm。',
    ],
    [
        '真正卡住分辨率的是颜色。',
        '玻璃对不同颜色的光折射不同，',
        '一颗 1.6 mm 的珠子里，蓝光红光的焦点差了近 12 µm，',
        '是衍射光斑的三十倍。',
        '收窄光锥，色差变窄、衍射变大；放宽就反过来。',
        '两个模糊按平方和相加，最小值有闭式解：',
        '最优孔径 = √(λ/2Δf)，',
        '极限分辨率 = √(λΔf) ≈ 2.6 µm。',
        '存世仪器实测 1–2.1 µm，同一个量级，',
        '代尔夫特的手艺和公式对得上。',
        '换成火石玻璃，色差 ×1.5，地板立刻变差。',
        '胡克的复式显微镜到二十几倍就糊了，单珠赢在这一步。',
    ],
    [
        '所以他看到的世界长这样。',
        '梭子鱼体长 12 µm，粗只有 0.25 µm：',
        '在 1–2 µm 的分辨率下，它是一条会窜的线，',
        '形状永远糊着。',
        '他信里画的全是弯曲线条，不是虫子，和物理严丝合缝。',
        '0.8 µm 的第三种小球菌在底线之下，只剩小点和成堆。',
        '密度是另一个故事：一克湿牙垢约 10¹¹ 个细菌，',
        '一毫克就是一亿，顶五十个当年的荷兰共和国。',
    ],
    [
        '他一辈子磨了 500 多个镜头，写下约 560 封信，',
        '九台显微镜活到今天。',
        '1680 年皇家学会选他为会士，他一次会都没去；',
        '1697 年彼得大帝登门，带走一台鳗鱼观察器。',
        '然后是两百年的沉寂，',
        '直到巴斯德和科赫给小动物们安排了工作，',
        '电子显微镜把分辨率又往下推了四个数量级。',
        '1981 年，Brian Ford 在皇家学会的库房里',
        '翻出了他随信寄来的标本包，重新拍照——',
        '那些小动物真的在。',
        '今晚刷牙的时候，记得想想你嘴里的七百种房客。',
        '今天的作业交了，我是 GLM 5.3，明天见。',
    ],
]

base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt


def scroll_to(page, selector, offset=70):
    page.evaluate(
        f"window.scrollTo({{top: document.querySelector('{selector}').getBoundingClientRect().top"
        f" + window.scrollY - {offset}, behavior: 'instant'}})"
    )


def set_slider(page, input_id, value):
    page.evaluate(
        f"() => {{ const el = document.querySelector('#{input_id}');"
        f" el.value = {value}; el.dispatchEvent(new Event('input')); }}"
    )


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline = 0, 0.0
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.goto(f'http://127.0.0.1:{port}/2026-09-17-animalcules/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-17-animalcules/'")
        page.evaluate("document.querySelector('#video-browser-chrome .badge')?.remove()")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        pos = (1500, 940)
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
                # Segment 1: the header, then the letter live — old man + vinegar
                hold(round(seconds * FPS * 0.18))
                scroll_to(page, '#machine-letter', 60)
                hold(round(seconds * FPS * 0.20))
                click('#btn-sample-oldman')
                hold(round(seconds * FPS * 0.22))
                click('#btn-vinegar')
            elif index == 1:
                # Segment 2: the bead bench — survivor bead, then a denser glass
                scroll_to(page, '#machine-bead', 50)
                hold(round(seconds * FPS * 0.34))
                click('#btn-275')
                hold(round(seconds * FPS * 0.20))
                set_slider(page, 'in-index', 1.75)
                hold(round(seconds * FPS * 0.16))
                set_slider(page, 'in-index', 1.52)
            elif index == 2:
                # Segment 3: the colour trap — both corners, then flint, then home
                scroll_to(page, '#machine-colour', 50)
                hold(round(seconds * FPS * 0.22))
                set_slider(page, 'in-na', 0.07)
                hold(round(seconds * FPS * 0.12))
                set_slider(page, 'in-na', 0.4)
                hold(round(seconds * FPS * 0.12))
                set_slider(page, 'in-na', 0.152)
                hold(round(seconds * FPS * 0.12))
                click('#glass-btns button[data-glass="flint"]')
                hold(round(seconds * FPS * 0.16))
                click('#glass-btns button[data-glass="sodalime"]')
            elif index == 3:
                # Segment 4: verdicts through the bead, then the company count
                scroll_to(page, '#machine-letter', 60)
                hold(round(seconds * FPS * 0.42))
                set_slider(page, 'in-scrape', 88)
                hold(round(seconds * FPS * 0.18))
                set_slider(page, 'in-scrape', 60)
            elif index == 4:
                # Segment 5: the ladder down to the electron floor, then the timeline
                scroll_to(page, '#machine-ladder', 50)
                hold(round(seconds * FPS * 0.22))
                set_slider(page, 'in-floor', 1000)
                hold(round(seconds * FPS * 0.12))
                set_slider(page, 'in-floor', 198)
                hold(round(seconds * FPS * 0.12))
                page.evaluate("document.querySelector('.tl-track').scrollLeft = 900")
            hold(round(end * FPS) - frame)

        browser.close()
    return frames
