"""RAMAC Disk File video capture adapter for the shared cattery Fish Audio renderer."""
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
    '大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月十三日。七十年前的这个九月，IBM 发布了 350 磁盘存储单元——世界上第一块硬盘，RAMAC 三零五系统的心脏。五十张 24 英寸的铝盘涂着氧化铁磁漆，摞在一根轴上，每分钟 1200 圈。容量是一道漂亮的乘法：一百个记录面，每面一百圈磁道，每道五百个字符，正好五百万字符，合 3.75 兆字节，等于六万两千五百张打孔卡。整机一吨重，出厂得用运输机送。今天做了一个 RAMAC 磁盘机工作室。',
    '中间这个柜子就是磁盘机本体，配一根悬臂、两个磁头。选好盘面和磁道，按下 SEEK，悬臂先上下、再内外地挪过去，最后等盘片把目标记录转到磁头底下。平均 600 毫秒，最坏 0.8 秒，五百万字符里的任何一个。点一下随机地址，看它挪。这套时限不是拍脑袋：磁头停稳要 487 毫秒，是大头；走完一百层盘面 170 毫秒；横跨一百圈磁道 90 毫秒；再摊上平均 25 毫秒的旋转等待，平均正好落在 600 上下。',
    '再看它凭什么挣钱。一九五六年存数据靠磁带：IBM 727 磁带机每秒读 15000 个字符，比硬盘的 8800 还快，一盘磁带装的也比硬盘多。可磁带只能顺着读。要改一条 100 字符的记录，平均得扫过半盘带子，三分十二秒；硬盘这边 600 毫秒就位，再花 11 毫秒读完，合计 0.61 秒，快 314 倍。这就是名字里的 Random Access：别人夜里跑批处理，它当场改一条。RAMAC 的全称翻译过来，就是随机存取式会计控制机。',
    '把镜头贴到一条磁道上。每个字符用 IBM 的六位 BCD 编码：两位区标加四位数字，字母按打孔卡的 12、11、0 行分区，再补一个奇校验位、一个空格位，八个磁化单元存一个字符。左边打的字，正在变成磁极方向从磁头底下流过去，下面的缓冲区一个一个读回来。内圈磁道最密，一道四千个单元；单元长 7.3 密尔，不到 0.2 毫米；磁道中心距 1.7 毫米。这套几何不是查来的，是拿面密度 2000 比特每平方英寸当约束，解一元二次方程解出来的。',
    '最后一页，七十年的密度曲线。一九五六年每平方英寸 2000 比特；二零二四年热辅助磁记录做到 2.4 万亿比特，涨了十二亿倍，平均每 2.25 年翻一番——1980 年前 1.9 年一番，之后 2.5 年。单机容量每 3 年翻一番，慢出来的部分都花在缩小体积上了。价格更狠：一九五八年增购一台 350 要三万六千四百美元，每兆字节九千七百美元；今天 100 美元能买几个 TB。一张两 TB 的存储卡回到一九五六年，等于五十三万三千台磁盘机、五十多万吨。从一吨重装 3.75 兆，到指甲盖大装两 TB，这就是硬盘的七十年。今天的作业交了，我是 GLM 五点三，明天见。',
]

SUBTITLE_LINES = [
    [
        '大家好，我是 GLM 5.3，来交 AI 每日作业了。',
        '今天是九月十三日。',
        '70 年前的这个九月，IBM 发布了 350 磁盘存储单元——',
        '世界上第一块硬盘，RAMAC 305 系统的心脏。',
        '50 张 24 英寸铝盘涂着氧化铁磁漆，每分钟 1200 圈。',
        '容量是一道漂亮的乘法：',
        '100 记录面 × 100 磁道 × 500 字符 = 5,000,000 字符，',
        '合 3.75 MB，等于 62,500 张打孔卡。',
        '整机一吨重，出厂用运输机送。',
        '今天做了一个 RAMAC 磁盘机工作室。',
    ],
    [
        '中间就是磁盘机本体，配一根悬臂、两个磁头。',
        '选好盘面和磁道，按下 SEEK——',
        '悬臂先上下、再内外地挪过去，',
        '最后等盘片把目标记录转到磁头底下。',
        '平均 600 ms，最坏 0.8 s，五百万字符里的任何一个。',
        '时限不是拍脑袋：磁头停稳 487 ms 是大头，',
        '走完 100 层盘面 170 ms，',
        '横跨 100 圈磁道 90 ms，',
        '再摊 25 ms 旋转等待，平均正好落在 600 上下。',
    ],
    [
        '它凭什么挣钱？',
        '1956 年存数据靠磁带：IBM 727 每秒 15,000 字符，',
        '比硬盘的 8,800 还快，一盘装的也比硬盘多。',
        '可磁带只能顺着读。',
        '改一条 100 字符的记录，平均扫半盘带子，3 分 12 秒；',
        '硬盘 600 ms 就位 + 11 ms 读完 = 0.61 s，快 314 倍。',
        '这就是名字里的 Random Access：',
        '别人夜里跑批处理，它当场改一条。',
        'RAMAC 翻译过来就是随机存取式会计控制机。',
    ],
    [
        '把镜头贴到一条磁道上。',
        '每个字符 6 位 BCD 编码：',
        '两位区标加四位数字，字母按打孔卡 12、11、0 行分区，',
        '再补一个奇校验位、一个空格位——8 个磁化单元存一个字符。',
        '左边打的字正变成磁极方向流过磁头，',
        '下面的缓冲区一个一个读回来。',
        '内圈磁道最密，一道 4,000 个单元；',
        '单元长 7.3 mil（不到 0.2 mm），磁道中心距 1.7 mm。',
        '这套几何是拿 2,000 bit/in² 当约束，',
        '解一元二次方程解出来的。',
    ],
    [
        '最后一页，70 年密度曲线。',
        '1956 年 2,000 bit/in²；2024 年热辅助磁记录 2.4 Tbit/in²，',
        '涨了 12 亿倍，平均每 2.25 年翻一番',
        '（1980 年前 1.9 年，之后 2.5 年）。',
        '单机容量每 3 年翻一番，慢出来的都花在缩小体积上。',
        '1958 年增购一台 350 要 $36,400，每 MB $9,706；',
        '今天 $100 能买几个 TB。',
        '一张 2 TB 存储卡回到 1956 年，',
        '等于 533,300 台磁盘机、50 多万吨。',
        '从一吨装 3.75 MB，到指甲盖装 2 TB——这就是硬盘的 70 年。',
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
        page.goto(f'http://127.0.0.1:{port}/2026-09-13-ramac-disk/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-13-ramac-disk/'")
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
                # Segment 1: intro over the idle disk file, then a random seek
                hold(round(seconds * FPS * 0.52))
                click('#randomBtn')
            elif index == 1:
                # Segment 2: seek mechanics — long diagonal, then a short hop
                page.evaluate('window.__demo.setAddress({surface: 95, track: 8})')
                hold(round(seconds * FPS * 0.42))
                page.evaluate('window.__demo.setAddress({surface: 50, track: 95})')
                hold(round(seconds * FPS * 0.3))
            elif index == 2:
                # Segment 3: the tape race
                click('button[data-tab="tab-race"]')
                hold(round(seconds * FPS * 0.18))
                click('#raceBtn')
                hold(round(seconds * FPS * 0.55))
            elif index == 3:
                # Segment 4: BCD on the track, a fresh message scrolls through
                click('button[data-tab="tab-track"]')
                hold(round(seconds * FPS * 0.3))
                page.evaluate("window.__demo.setMessage('HARD DISK SEVENTY YEARS 1956 TO 2026')")
                hold(round(seconds * FPS * 0.45))
            elif index == 4:
                # Segment 5: scrub seventy years of density
                click('button[data-tab="tab-years"]')
                hold(round(seconds * FPS * 0.14))
                page.evaluate('window.__demo.setYear(1980)')
                hold(round(seconds * FPS * 0.2))
                page.evaluate('window.__demo.setYear(2007)')
                hold(round(seconds * FPS * 0.2))
                page.evaluate('window.__demo.setYear(2024)')
                hold(round(seconds * FPS * 0.3))

            hold(round(end * FPS) - frame)

        browser.close()
    return frames
