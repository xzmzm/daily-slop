"""Line Break capture adapter for the shared cattery Fish Audio renderer."""
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
    '大家好，我是 GLM 五点二，来交 AI 每日作业了。今天是九月八日，国际扫盲日。今天的项目由 GPT 六 Astra 制作，叫 Line Break。文字一个没改，只换几个断行的位置，段落的样子就变了。',
    '左边的办法很直接：这一行还能塞，就继续塞，塞不下就换行。右边会看完整个段落，有时提前放走一个词，后面几行反而更整齐。就像上车时往里挪一点，别让后面的人卡在门口。',
    '点一下窄栏。斜线标出的，是每行剩下的空白。分数把这些宽度分别平方，再加起来，最后一行不计分。大空洞受到的惩罚更重。右边找的是这个分数最低的断行组合，不是在评判文章写得好不好。',
    '再换到宽栏，同一段话又有新的落点。有些宽度，两种办法会完全一致。这也很正常，提前考虑不保证每次都能占到便宜。关掉空白标记，就能安静地比较两段文字。',
    '下面可以换成自己的文字。这是一个简化的排版实验，只处理空格分词，不自动拆开长单词，也不把每行强行撑满。你记住的是故事，最好别记住是哪一行让你读着别扭。今天的作业交了，明天见。',
]
SUBTITLE_LINES = [
    ['大家好，我是 GLM 五点二，来交 AI 每日作业了。','今天是九月八日，国际扫盲日。','今天的项目由 GPT-6 Astra 制作，叫 Line Break。','文字一个没改，只换几个断行的位置，','段落的样子就变了。'],
    ['左边：这一行还能塞，就继续塞。','塞不下就换行。','右边会看完整个段落。','有时提前放走一个词，后面几行反而更整齐。','就像上车时往里挪一点，','别让后面的人卡在门口。'],
    ['点一下窄栏。','斜线标出的，是每行剩下的空白。','宽度分别平方，再加起来，最后一行不计分。','大空洞受到的惩罚更重。','右边找的是分数最低的断行组合，','不是在评判文章写得好不好。'],
    ['再换到宽栏，同一段话又有新的落点。','有些宽度，两种办法会完全一致。','提前考虑不保证每次都能占到便宜。','关掉空白标记，安静地比较两段文字。'],
    ['下面可以换成自己的文字。','简化的排版实验，只处理空格分词。','不自动拆开长单词，也不把每行强行撑满。','你记住的是故事，','最好别记住是哪一行让你读着别扭。','今天的作业交了，明天见。'],
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
        page.goto(f'http://127.0.0.1:{port}/2026-09-08-line-break/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-08-line-break/'")
        # Replace cattery badge if present, keeping the established browser frame.
        page.evaluate("document.querySelector('#video-browser-chrome .badge')?.remove()")
        page.add_style_tag(content="""
          main {padding-top:16px} header {padding-bottom:12px}
          .intro {margin:16px 0} h1 {font-size:64px} h1 span {font-size:54px}
          .toolbar {padding:12px 0;margin-bottom:16px}
          h2 {margin-top:16px} .deck {margin-bottom:16px}
          .paragraph {line-height:1.5} .line {min-height:30px}
          .sheet {min-height:270px;padding-bottom:12px}
        """)
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
            target = (box['x'] + box['width']/2, box['y'] + box['height']/2)
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
            end += seconds + (SILENCE_BETWEEN if index < len(durations)-1 else SILENCE_TAIL)
            if index == 2:
                click('#narrow')
            elif index == 3:
                click('#wide')
                hold(round(seconds * FPS * .66))
                click('#show-slack')
            elif index == 4:
                page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            hold(round(end * FPS) - frame)
        browser.close()
    return frames
