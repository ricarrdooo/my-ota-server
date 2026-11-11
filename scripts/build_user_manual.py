"""Build the illustrated Chinese PDF and offline HTML from current UI captures.

Run with the bundled Codex Python (reportlab/Pillow/pypdf). Screenshots stay
unchanged: rectangles, arrows and numbered markers are separate vector layers.
"""
from pathlib import Path
import base64, copy, html, json, math, shutil
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT.parent/'00_BASIC'
ASSETS=ROOT/'docs/user_manual_assets'
TEMP=WORK/'tmp/ota_user_manual'
OUT=ROOT/'output/pdf'
OUT.mkdir(parents=True,exist_ok=True)
FONT='Manual';BOLD='ManualBold'
pdfmetrics.registerFont(TTFont(FONT,'C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont(BOLD,'C:/Windows/Fonts/msyhbd.ttc',subfontIndex=0))
pdfmetrics.registerFontFamily(FONT,normal=FONT,bold=BOLD,italic=FONT,boldItalic=BOLD)
W,H=A4;M=38;CW=W-2*M
GREEN=colors.HexColor('#21543f');INK=colors.HexColor('#182a24')
GRAY=colors.HexColor('#52635d');LINE=colors.HexColor('#dce5df')
PALE=colors.HexColor('#f0f6f1');ORANGE=colors.HexColor('#d65d2e')
audit=[]

def sync_assets():
    source=TEMP/'screenshots/manifest.json'
    if not source.exists():return
    manifest=json.loads(source.read_text(encoding='utf8'))
    for shot in manifest['screenshots']:
        original=Path(shot['file'])
        if not original.is_absolute():original=source.parent/original
        if not original.exists():original=source.parent/Path(shot['file']).name
        dest=ASSETS/'screenshots'/original.name;dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(original,dest);shot['file']='screenshots/'+original.name
    (ASSETS/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')

def para(c,text,x,y,width,size=10.8,color=INK,bold=False,leading=None):
    style=ParagraphStyle('manual',fontName=BOLD if bold else FONT,fontSize=size,
        leading=leading or size*1.55,textColor=color,wordWrap='CJK',spaceAfter=0)
    p=Paragraph(html.escape(text).replace('\n','<br/>'),style)
    _,height=p.wrap(width,1000);p.drawOn(c,x,y-height)
    return y-height

def box(c,text,y,label='提示',fill=PALE,size=10):
    style=ParagraphStyle('box',fontName=FONT,fontSize=size,leading=size*1.5,wordWrap='CJK')
    p=Paragraph(html.escape(text).replace('\n','<br/>'),style);_,height=p.wrap(CW-30,1000)
    total=height+44
    c.setFillColor(fill);c.roundRect(M,y-total,CW,total,7,fill=1,stroke=0)
    para(c,label,M+15,y-11,CW-30,9.5,GREEN,True)
    p.drawOn(c,M+15,y-31-height)
    return y-total-12

def header(c,page,total,section):
    c.setFillColor(GREEN);c.setFont(BOLD,9);c.drawString(M,H-27,'OTA STATION')
    c.setFillColor(GRAY);c.setFont(FONT,8.5);c.drawRightString(W-M,H-27,section)
    c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(M,H-40,W-M,H-40)
    c.line(M,42,W-M,42)
    c.setFillColor(GRAY);c.setFont(FONT,8);c.drawString(M,27,'用户手册  |  2026-11-05  |  截图为隔离演示')
    c.drawRightString(W-M,27,f'{page:02d} / {total:02d}')

def title(c,text):
    return para(c,text,M,H-66,CW,22,INK,True,29)-18

def table(c,rows,y,first=130):
    for i,(left,right) in enumerate(rows):
        sty=ParagraphStyle('row',fontName=FONT,fontSize=10.2,leading=16,wordWrap='CJK')
        a=Paragraph(html.escape(left),ParagraphStyle('left',parent=sty,fontName=BOLD,textColor=GREEN))
        b=Paragraph(html.escape(right).replace('\n','<br/>'),sty)
        _,ha=a.wrap(first-24,1000);_,hb=b.wrap(CW-first-24,1000);rh=max(ha,hb)+24
        c.setFillColor(PALE if i%2==0 else colors.white);c.rect(M,y-rh,CW,rh,fill=1,stroke=0)
        a.drawOn(c,M+12,y-12-ha);b.drawOn(c,M+first+12,y-12-hb)
        c.setStrokeColor(LINE);c.line(M,y-rh,W-M,y-rh);y-=rh
    return y-16

def shot_layout(shot):
    """Focus two wide/long captures using vector viewports, without altering PNGs."""
    iw,ih=Image.open(ASSETS/shot['file']).size
    panels=[(0,0,iw,ih,0,0)];vw,vh=iw,ih
    if shot['id']=='04_target':
        panels=[(0,65,440,140,0,0),(700,65,350,140,0,180)]
        vw,vh=440,320
    elif shot['id']=='07_pack':
        panels=[(0,0,726,451,0,0),(0,595,726,76,0,475)]
        vw,vh=726,551
    annotations=[]
    for item in shot['annotations']:
        a=copy.deepcopy(item);r=a['rect']
        for px,py,pw,ph,dx,dy in panels:
            if px<=r['x']+r['width']/2<=px+pw and py<=r['y']+r['height']/2<=py+ph:
                r['x']+=dx-px;r['y']+=dy-py;break
        else:raise ValueError('Annotation outside view: '+shot['id'])
        annotations.append(a)
    return vw,vh,panels,annotations


def annotation_shapes(shot,annotations):
    right={('03_product',3),('05_add_device',4),('07_pack',4),
           ('09_pack_result',3),('10_publish',2),('11_upgrade',3),('14_restart',3)}
    shapes=[]
    for a in annotations:
        r=a['rect'];x,y,w,h=(float(r[k]) for k in ('x','y','width','height'))
        if w<=0 or h<=0:continue
        # Keep the marker near the highlighted control; the extra viewBox margin
        # prevents markers next to a dialog edge from being clipped.
        cx=x-30;cy=y+min(h/2,24);ex=x;ey=cy
        if (shot['id'],a['number']) in right:
            cx=x+w+30;cy=y+h/2;ex=x+w;ey=cy
        elif shot['id']=='02_overview' and a['number']==3:
            cx=x+w/2;cy=y-30;ex=cx;ey=y
        shapes.append((a,x,y,w,h,cx,cy,ex,ey))
    return shapes

def shot_pdf(c,shot,y,maxheight):
    path=ASSETS/shot['file'];origw,origh=Image.open(path).size
    iw,ih,panels,annotations=shot_layout(shot)
    pad=42;vw=iw+pad*2;vh=ih+pad*2;scale=min(CW/vw,maxheight/vh)
    fw,fh=vw*scale,vh*scale;x=M+(CW-fw)/2
    c.setFillColor(colors.white);c.setStrokeColor(LINE);c.roundRect(x,y-fh,fw,fh,6,fill=1,stroke=1)
    sx=x+pad*scale;sy=y-(pad+ih)*scale
    for px,py,pw,ph,dx,dy in panels:
        c.saveState();clip=c.beginPath()
        clip.rect(sx+dx*scale,sy+(ih-dy-ph)*scale,pw*scale,ph*scale)
        c.clipPath(clip,stroke=0,fill=0)
        c.drawImage(ImageReader(str(path)),sx+(dx-px)*scale,sy+(ih-dy+py-origh)*scale,origw*scale,origh*scale)
        c.restoreState()
    for a,rx,ry,rw,rh,cx,cy,tx,ty in annotation_shapes(shot,annotations):
        ax=sx+rx*scale;ay=sy+(ih-ry-rh)*scale
        c.setStrokeColor(ORANGE);c.setLineWidth(max(1.3,2*scale))
        c.roundRect(ax,ay,rw*scale,rh*scale,min(4,4*scale),fill=0,stroke=1)
        bx=sx+cx*scale;by=sy+(ih-cy)*scale
        radius=max(8.5,13*scale)
        ex=sx+tx*scale;ey=sy+(ih-ty)*scale
        angle=math.atan2(ey-by,ex-bx)
        c.setLineWidth(1.3);c.line(bx+radius*math.cos(angle),by+radius*math.sin(angle),ex,ey)
        arrow=3
        p=c.beginPath();p.moveTo(ex,ey);p.lineTo(ex-arrow*math.cos(angle-.45),ey-arrow*math.sin(angle-.45));p.lineTo(ex-arrow*math.cos(angle+.45),ey-arrow*math.sin(angle+.45));p.close()
        c.setFillColor(ORANGE);c.drawPath(p,fill=1,stroke=0)
        c.circle(bx,by,radius,fill=1,stroke=0)
        c.setFillColor(colors.white);c.setFont(BOLD,10);c.drawCentredString(bx,by-3.7,str(a['number']))
    return y-fh-9

def draw_screen(c,page,shots):
    shot=shots[page['shot']];y=title(c,page['title'])
    y=para(c,page['intro'],M,y,CW)-11
    if page.get('code'):
        y=box(c,'\n'.join(page['code']),y,'在 PowerShell 执行',size=9.5)
    # Reserve the actual wrapped legend height, rather than shrinking its type.
    legend=[];legend_height=0
    for a in shot['annotations']:
        style=ParagraphStyle('measure',fontName=FONT,fontSize=10.6,leading=16.4,wordWrap='CJK')
        p=Paragraph(html.escape(a['label']),style);_,h=p.wrap(CW-30,1000);legend_height+=h+6
        legend.append((a,p,h))
    note_style=ParagraphStyle('measureNote',fontName=FONT,fontSize=9.4,leading=14,wordWrap='CJK')
    def height(text,width=CW):
        p=Paragraph(html.escape(text),note_style);return p.wrap(width,1000)[1]
    reserve=legend_height+height(page['note'])+height(page['tip'])+height(page['success'],CW-30)+125
    maxheight=min(450,y-54-reserve)
    if maxheight<150:raise ValueError('Too little image space: '+page['title'])
    y=shot_pdf(c,shot,y,maxheight)
    focus=' · 操作区局部放大' if shot['id'] in {'04_target','07_pack'} else ''
    y=para(c,f"图 {page['figure']:02d}  {shot.get('title',page['title'])}  · 示例数据{focus}",M,y,CW,8.2,GRAY)-12
    for a,p,h in legend:
        c.setFillColor(ORANGE);c.circle(M+8,y-7,7.5,fill=1,stroke=0)
        c.setFillColor(colors.white);c.setFont(BOLD,9);c.drawCentredString(M+8,y-10,str(a['number']))
        p.drawOn(c,M+26,y-h);y-=h+6
    y=para(c,page['note'],M,y-3,CW,9.4,GRAY,leading=14)-11
    y=box(c,page['success'],y,'完成后应看到',size=9.4)
    y=para(c,page['tip'],M,y,CW,9.2,GRAY,leading=13.5)
    return y

def cover(c,total):
    y=H-105
    y=para(c,'个人固件发布与设备控制',M,y,CW,12,GREEN,True)-18
    y=para(c,'OTA 平台用户手册',M,y,CW,31,colors.black,True,43)-12
    y=para(c,'照着截图找到按钮，按编号完成操作。\n适用于当前 Vue 管理后台与 ESP32 V1.0.8。',M,y,CW,12,GRAY)-28
    y=box(c,'已有设备日常升级：打包并上传 → 确认发布 → 下发升级 → 查看执行成功。\n第一次接入新板子时，先完成产品、型号、设备凭据和设备端配置。',y,'先选择你的路线',size=11)
    y=table(c,[('开始使用','第 3–4 页：启动、登录与认识工作台'),('新设备首次接入','第 5–10 页：产品、型号、凭据、设备配置与签名'),('已有设备日常升级','第 11–16 页：上传、发布、升级与结果确认'),('重启和手动清理','第 17–18 页：重启设备、管理固件与发布'),('更换环境和排查','第 19–20 页：换地址、换电脑、密码与连接问题')],y)
    y=para(c,'截图说明',M,y-1,CW,12,GREEN,True)-9
    y=para(c,'截图来自当前程序的隔离演示环境。名称、标识、文件大小、网址和版本以你的实际页面为准。图中示例固件仅用于说明界面，不提供给真实设备安装。橙色编号与框线表示操作位置。',M,y,CW,10.5,GRAY)-12
    y=para(c,'文档日期 2026-11-05  ·  适用电脑浏览器操作\n本手册不记录任何真实登录密码、设备访问密钥或签名私钥。',M,y,CW,9.5,GRAY)
    return y

def basics(c):
    y=title(c,'先分清设备和三类凭据')
    y=para(c,'“产品”组织同一项目，“硬件型号”描述兼容板型，“设备”代表一台实体板子。多加一台相同板子，通常只需新增设备。',M,y,CW)-15
    y=table(c,[('产品','例：桌面伴侣。一个产品可有不同硬件型号。'),('硬件型号','例：ESP32-S3 N8R8 桌面伴侣。型号引用对应签名公钥，决定允许安装的固件。'),('设备','例：书桌设备、卧室设备。每台设备有自己的标识和访问密钥。')],y)
    y=para(c,'三类凭据不要混用',M,y,CW,15,GREEN,True)-13
    y=table(c,[('管理员登录密码','用途：人登录网页后台。\n来源：自己在部署时设置。忘记后在服务器电脑重设。'),('设备访问密钥','用途：填到设备设置页，让板子访问 OTA 平台。\n来源：创建设备或轮换凭据时显示，只显示一次。'),('签名私钥和保护密码','用途：在本机给固件签名，浏览器记住后通常不用重复导入。\n设备不填写私钥。加密文件首次导入要用原保护密码。')],y,145)
    y=box(c,'同一型号的多台设备可以使用同一套签名信任；每台设备的访问密钥仍独立。签名私钥不是“一台设备一个登录密码”。',y,'最常见的混淆',size=10)
    return y

def maintenance(c):
    y=title(c,'更换地址 电脑和常用维护')
    y=table(c,[('临时网址变了','重新启动临时隧道后，以启动窗口输出的新 HTTPS 地址为准。设备网页只改服务器地址，同一设备的访问密钥留空沿用。网站地址变化后，浏览器可能需要重新导入原签名私钥。'),('设备或电脑换网络','从设备屏幕重新查看 IP，再打开设置网页。设备设置页需要与板子在同一局域网互通；平台公网地址则可通过互联网访问。'),('更换运行后台的电脑','先完整备份旧后台的数据目录和固件文件，再按部署说明准备新电脑运行环境。保留原数据库、固件、公开配置和私钥备份，避免重新创建现有设备。'),('只是电脑采集地址变了','在设备设置网页修改电脑 IP、采集端口和对应采集密钥。这些是电脑指标服务配置，不是 OTA 管理员账号或设备访问密钥。'),('停止或重启后台','关闭前确认没有正在下载的升级。公共服务按现有启动方式停止和重启；临时隧道重建后记得核对新地址。')],y,130)
    y=para(c,'忘记管理员登录密码',M,y,CW,14,GREEN,True)-11
    y=para(c,'在服务器电脑的 PowerShell 中执行下面两行，然后按提示输入两次新密码，至少 12 个字符。输入时终端不显示字符是正常的。重设会注销原有网页登录会话。',M,y,CW,10.4)-12
    y=box(c,"cd 'F:\\Code\\esp32\\My OTA Server'\n.\\.venv\\Scripts\\python.exe -m ota_server reset-admin",y,'本机重设命令',size=9.5)
    return y

def faq(c):
    y=title(c,'遇到问题按提示逐项排查')
    y=table(c,[('页面打不开','先看后台和隧道是否仍运行，再核对最新 HTTPS 地址。电脑关机、休眠或临时域名失效时，先恢复服务。'),('设备一直离线','确认板子供电、Wi-Fi 可上网，设备设置中的服务器地址、设备标识和密钥正确。查看最近 HTTP 状态，等待下一次心跳。'),('按钮要求更新固件','平台已更新不等于板子已更新。网页远程指令需客户端支持，本项目 V1.0.7 起支持；先安装对应基础固件。'),('HTTP 401 或密钥错误','核对填的是此设备的访问密钥，而不是登录密码或签名私钥。若已轮换，设备上必须同步新密钥。'),('HTTP 0 或连接超时','未收到 HTTP 响应，先检查 Wi-Fi、地址、校时和公网隧道。稍后刷新记录；最近一次 HTTP 200 不会清除历史失败说明。'),('本机签名尚未导入','确认是否换了浏览器或网站地址。重新导入该型号原私钥；原浏览器仍有记录时先保留，不要为省事更换整套签名密钥。'),('指令已提交却没升级','先看控制记录。设备可能尚未领取、正在执行，或已过等待有效期；同一完整文件摘要已安装时也会跳过下载。'),('不能删除固件或发布','先看预览中的引用与阻止原因。活动发布、进行中的下载、待执行指令和历史依赖需按提示处理，不要强行删服务器文件。')],y,135)
    y=box(c,'本版本提供固件管理、网页升级和远程重启。网页运行日志、ESP32 内存与任务变量监控、远程参数下发、崩溃上传分析尚未开放。屏幕上的电脑指标不等于 ESP32 自身的运行诊断。',y,'功能范围',size=9.4)
    return y

def svg(shot):
    origw,origh=Image.open(ASSETS/shot['file']).size;pad=42
    iw,ih,panels,annotations=shot_layout(shot)
    data=base64.b64encode((ASSETS/shot['file']).read_bytes()).decode()
    parts=[f'<svg class="shot" viewBox="{-pad} {-pad} {iw+2*pad} {ih+2*pad}" role="img" aria-label="{html.escape(shot.get("title",shot["id"]))}"><defs><marker id="arrow-{shot["id"]}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#d65d2e"/></marker></defs>']
    for px,py,pw,ph,dx,dy in panels:
        parts.append(f'<svg x="{dx}" y="{dy}" width="{pw}" height="{ph}" viewBox="{px} {py} {pw} {ph}"><image width="{origw}" height="{origh}" href="data:image/png;base64,{data}"/></svg>')
    for a,x,y,w,h,cx,cy,ex,ey in annotation_shapes(shot,annotations):
        angle=math.atan2(ey-cy,ex-cx);ax=cx+16*math.cos(angle);ay=cy+16*math.sin(angle)
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="none" stroke="#d65d2e" stroke-width="3"/><line x1="{ax}" y1="{ay}" x2="{ex}" y2="{ey}" stroke="#d65d2e" stroke-width="2.3" marker-end="url(#arrow-{shot["id"]})"/><circle cx="{cx}" cy="{cy}" r="16" fill="#d65d2e"/><text x="{cx}" y="{cy+5.6}" fill="white" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="700">{a["number"]}</text>')
    return ''.join(parts)+'</svg>'

def html_manual(content,shots):
    esc=html.escape;sections=[]
    for i,p in enumerate(content['pages'],1):
        body=''
        if p['type']=='screen':
            s=shots[p['shot']]
            code='<pre>'+esc('\n'.join(p['code']))+'</pre>' if p.get('code') else ''
            body=f'<p class="lead">{esc(p["intro"])}</p>{code}<figure>{svg(s)}<figcaption>图 {p["figure"]:02d} {esc(s.get("title",p["title"]))} · 示例数据</figcaption></figure><ol class="steps">'+''.join(f'<li><b>{a["number"]}</b><span>{esc(a["label"])}</span></li>' for a in s['annotations'])+f'</ol><p>{esc(p["note"])}</p><aside><strong>完成后应看到</strong><p>{esc(p["success"])}</p></aside><p class="tip">{esc(p["tip"])}</p>'
        elif p['type']=='cover':
            body='<p class="lead">照着截图找到按钮，按编号完成操作。适用于当前 Vue 管理后台与 ESP32 V1.0.8。</p><aside><strong>已有设备日常升级</strong><p>打包并上传 → 确认发布 → 下发升级 → 查看执行成功</p></aside><p>新板先完成产品、硬件型号、设备凭据和设备端配置。截图使用隔离演示数据，示例固件不用于真实设备安装。</p>'
        elif p['type']=='basics':
            body='<p>产品组织项目，硬件型号描述兼容板型，设备代表一台实体板子。已有型号下新增板子，通常只需添加设备。</p><table><tr><th>凭据</th><th>用途</th></tr><tr><td>管理员登录密码</td><td>人登录网页后台，自己设置；忘记后在服务器电脑重设。</td></tr><tr><td>设备访问密钥</td><td>板子访问 OTA 平台，创建设备或轮换时只显示一次，填入设备设置页。</td></tr><tr><td>签名私钥及保护密码</td><td>本机签名，设备不填写；浏览器记住后通常无需重复导入，加密文件首次导入仍需原密码。</td></tr></table><aside><p>同一型号的设备可共用签名信任，每台设备的访问密钥仍独立。</p></aside>'
        elif p['type']=='maintenance':
            body='<p>临时域名变化后，以启动窗口显示的新 HTTPS 地址为准；同一设备只改服务器地址，访问密钥留空沿用。</p><p>换电脑先完整备份旧后台数据目录、固件与私钥备份，再按部署说明迁移。电脑采集服务的 IP 和密钥在设备设置页单独修改。</p><h3>忘记管理员登录密码</h3><p>在服务器电脑运行下面命令，按提示输入两次新密码，至少 12 个字符。终端不显示输入字符是正常的。重设会注销旧网页会话。</p><pre>cd \'F:\\Code\\esp32\\My OTA Server\'\n.\\.venv\\Scripts\\python.exe -m ota_server reset-admin</pre>'
        else:
            body='<table>'+''.join(f'<tr><th>{esc(a)}</th><td>{esc(b)}</td></tr>' for a,b in [('页面打不开','确认后台与隧道运行，核对最新地址。'),('设备离线','确认供电、Wi-Fi、服务器地址、设备标识和访问密钥。'),('HTTP 401','核对设备访问密钥，轮换后必须同步到板子。'),('HTTP 0 或连接超时','检查网络、地址、校时和隧道，稍后刷新记录。'),('签名未导入','浏览器和网站地址有区别；导入原私钥或请维护人员协助复用原浏览器记录。'),('指令未完成','查看控制记录，区分等待、执行、过期和真正成功。'),('不能删除','按删除预览处理引用和进行中的升级，不强删文件。')])+'</table><aside><strong>功能范围</strong><p>已提供固件管理、远程升级与重启。网页运行日志、ESP32 任务变量、远程参数和崩溃分析尚未开放。</p></aside>'
        sections.append(f'<section class="page" id="p{i}"><div class="eyebrow">{esc(p.get("section","使用指南"))} · {i:02d} / {len(content["pages"]):02d}</div><h1>{esc(p["title"])}</h1>{body}</section>')
    toc=''.join(f'<a href="#p{i}">{i:02d} {esc(p["title"])}</a>' for i,p in enumerate(content['pages'],1))
    return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OTA 平台用户手册</title><style>html{scroll-behavior:smooth}*{box-sizing:border-box}body{margin:0;background:#e9f0eb;color:#182a24;font:17px/1.8 "Microsoft YaHei",sans-serif}.layout{display:grid;grid-template-columns:260px minmax(0,1040px);gap:28px;max-width:1370px;margin:auto;padding:28px}nav{position:sticky;top:20px;align-self:start;max-height:94vh;overflow:auto;padding:18px;background:white;border-radius:12px}nav strong{color:#21543f}nav a{display:block;font-size:13px;color:#415d4d;text-decoration:none;padding:5px 0}main{min-width:0}.page{background:white;padding:42px 50px;border-radius:12px;margin-bottom:24px;scroll-margin-top:20px}.eyebrow{font-size:13px;color:#21543f;letter-spacing:1px}h1{font-size:29px;line-height:1.45;margin:10px 0 18px}h3{color:#21543f}.lead{font-size:18px}figure{margin:24px 0}svg.shot{display:block;width:100%;max-height:720px;border:1px solid #dce5df;border-radius:8px;background:white}figcaption{font-size:13px;color:#65776c;text-align:center}.steps{list-style:none;padding:0}.steps li{display:flex;gap:12px;margin:8px 0}.steps b{background:#d65d2e;color:white;border-radius:50%;width:29px;height:29px;line-height:29px;text-align:center;flex:none}aside{background:#f0f6f1;padding:18px 23px;border-radius:8px;margin:20px 0}aside p{margin:4px 0}.tip{font-size:14px;color:#52635d}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #dce5df;padding:16px;text-align:left;vertical-align:top}th{color:#21543f;min-width:130px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f0f6f1;padding:18px;border-radius:8px;font:14px/1.8 Consolas,"Microsoft YaHei",monospace}@media(max-width:900px){.layout{display:block;padding:10px}nav{position:static;max-height:300px;margin-bottom:18px}.page{padding:24px}}@media print{@page{size:A4;margin:15mm}body{background:white}.layout{display:block;padding:0}nav{display:none}.page{padding:0;border-radius:0;break-after:page;box-shadow:none}svg.shot{max-height:160mm}h1{font-size:22pt}body{font-size:11pt}}</style><div class="layout"><nav><strong>OTA 平台用户手册</strong>'+toc+'</nav><main>'+''.join(sections)+'</main></div></html>'

def main():
    sync_assets();content=json.loads((ASSETS/'manual_content.json').read_text(encoding='utf8'))
    manifest=json.loads((ASSETS/'manifest.json').read_text(encoding='utf8'));shots={s['id']:s for s in manifest['screenshots']}
    required={p['shot'] for p in content['pages'] if p['type']=='screen'}
    if required-set(shots):raise ValueError('Missing screenshots: '+','.join(sorted(required-set(shots))))
    figure=0
    for p in content['pages']:
        if p['type']=='screen':figure+=1;p['figure']=figure
    filename=OUT/'OTA平台用户手册.pdf'
    c=canvas.Canvas(str(filename),pagesize=A4,pageCompression=1)
    c.setTitle(content['title']);c.setAuthor('OTA Station');c.setSubject('日常操作与首次接入的分步图文手册')
    for i,p in enumerate(content['pages'],1):
        header(c,i,len(content['pages']),p.get('section','使用指南'))
        c.bookmarkPage(f'p{i}');c.addOutlineEntry(p['title'],f'p{i}',level=0)
        if p['type']=='screen':y=draw_screen(c,p,shots)
        elif p['type']=='cover':y=cover(c,len(content['pages']))
        elif p['type']=='basics':y=basics(c)
        elif p['type']=='maintenance':y=maintenance(c)
        else:y=faq(c)
        if y<53:raise ValueError(f'Page {i} content clips footer ({y:.1f}): {p["title"]}')
        audit.append({'page':i,'title':p['title'],'bottom':round(y,1),'shot':p.get('shot')});c.showPage()
    c.save()
    (OUT/'OTA平台用户手册.html').write_text(html_manual(content,shots),encoding='utf8')
    TEMP.mkdir(parents=True,exist_ok=True);(TEMP/'layout_audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'pages':len(content['pages']),'figures':figure,'pdf':str(filename),'html':str(OUT/'OTA平台用户手册.html')},ensure_ascii=False))

if __name__=='__main__':main()
