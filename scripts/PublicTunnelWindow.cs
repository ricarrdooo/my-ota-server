using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections.Generic;

internal sealed class PublicTunnelWindow : Form
{
    readonly string root = AppDomain.CurrentDomain.BaseDirectory;
    readonly Label status = new Label();
    readonly TextBox url = new TextBox();
    readonly Button copy = new Button(), retry = new Button(), stop = new Button();
    readonly EventWaitHandle activate;
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    bool busy;

    PublicTunnelWindow(EventWaitHandle activateEvent)
    {
        activate = activateEvent;
        Text = "OTA 公网地址";
        Font = new Font("Microsoft YaHei UI", 10);
        AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(610, 253);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(248, 250, 249);
        var heading = new Label { Text = "ESP32 的 OTA 服务器地址", AutoSize = true,
            Font = new Font(Font.FontFamily, 16, FontStyle.Bold), Location = new Point(24, 20) };
        status.SetBounds(25, 62, 558, 48);
        status.AutoEllipsis = true;
        url.SetBounds(25, 112, 559, 29);
        url.ReadOnly = true;
        url.BackColor = Color.White;
        url.Font = new Font("Segoe UI", 11);
        copy.Text = "复制地址"; copy.SetBounds(25, 155, 111, 36);
        copy.BackColor = Color.FromArgb(31, 98, 82); copy.ForeColor = Color.White;
        copy.FlatStyle = FlatStyle.Flat;
        retry.Text = "重新检查"; retry.SetBounds(148, 155, 110, 36);
        stop.Text = "停止公网"; stop.SetBounds(474, 155, 110, 36);
        var note = new Label { Text = "复制到设备设置的「个人 OTA 服务器」。关闭此窗口后，公网服务继续运行。",
            Location = new Point(25, 207), Size = new Size(560, 36), ForeColor = Color.DimGray };
        Controls.AddRange(new Control[] { heading, status, url, copy, retry, stop, note });
        copy.Enabled = stop.Enabled = false;
        copy.Click += (s, e) => {
            try { Clipboard.SetText(url.Text); status.Text = "已复制，可以粘贴到设备的「服务器地址」。"; }
            catch (System.Runtime.InteropServices.ExternalException) {
                url.Focus(); url.SelectAll(); status.Text = "剪贴板正忙，地址已选中，请按 Ctrl+C 复制。";
            }
        };
        retry.Click += (s, e) => Run("connect");
        stop.Click += (s, e) => Run("stop");
        Shown += (s, e) => { timer.Start(); Run("connect"); };
        timer.Interval = 750;
        timer.Tick += (s, e) => {
            if (activate.WaitOne(0)) {
                WindowState = FormWindowState.Normal; Show(); Activate();
                if (!busy) Run("connect");
            }
            if (!busy && copy.Enabled && !StillRunning()) {
                url.Clear(); copy.Enabled = stop.Enabled = false;
                status.Text = "公网服务已停止。点「重新检查」可以再次启动。";
            }
        };
        FormClosed += (s, e) => timer.Dispose();
    }

    bool StillRunning()
    {
        try {
            string text = File.ReadAllText(Path.Combine(root, ".cache", "quick-tunnel.json"));
            var state = new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(text);
            if ((string)state["status"] != "ready" || (string)state["url"] != url.Text) return false;
            using (var p = Process.GetProcessById(Convert.ToInt32(state["pid"]))) return !p.HasExited;
        } catch (IOException) { return true; } // Atomic state replacement can briefly deny a read.
        catch (Exception) { return false; }
    }

    string Request(string action)
    {
        string python = Path.Combine(root, ".venv", "Scripts", "python.exe");
        if (!File.Exists(python)) throw new FileNotFoundException("请从 OTA 项目目录运行程序，或使用桌面快捷方式。");
        var start = new ProcessStartInfo(python, "-m ota_server.desktop_tunnel " + action) {
            WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
        };
        start.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
        using (var p = Process.Start(start)) {
            var output = p.StandardOutput.ReadToEndAsync();
            var errors = p.StandardError.ReadToEndAsync();
            p.WaitForExit();
            if (p.ExitCode != 0) throw new InvalidOperationException(errors.Result.Trim());
            string result = output.Result.Trim();
            if (action == "connect" && !Regex.IsMatch(result, @"\Ahttps://[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\z"))
                throw new InvalidDataException("尚未取得通过验证的 HTTPS 地址。");
            return result;
        }
    }

    async void Run(string action)
    {
        if (busy) return;
        busy = true; copy.Enabled = stop.Enabled = retry.Enabled = false; url.Clear();
        status.Text = action == "stop" ? "正在停止公网服务…" : "正在连接 Cloudflare，并检查公网地址是否可访问…";
        try {
            string result = await Task.Run(() => Request(action));
            if (IsDisposed) return;
            url.Text = result;
            copy.Enabled = stop.Enabled = result.Length > 0;
            status.Text = result.Length > 0 ? "公网验证通过，现在可以复制地址。" : "公网服务已停止。";
        } catch (Exception exc) {
            if (!IsDisposed) status.Text = string.IsNullOrEmpty(exc.Message) ? "启动失败，请重试。" : exc.Message;
        } finally {
            busy = false; if (!IsDisposed) retry.Enabled = true;
        }
    }

    [STAThread]
    static void Main()
    {
        bool first;
        using (var mutex = new Mutex(true, @"Local\OTAStation.PublicWindow.8000", out first))
        using (var show = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\OTAStation.PublicWindow.Show.8000")) {
            if (!first) { show.Set(); return; }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new PublicTunnelWindow(show));
        }
    }
}
