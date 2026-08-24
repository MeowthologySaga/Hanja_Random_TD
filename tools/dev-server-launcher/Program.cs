using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

namespace HanziFateFormation.DevServerLauncher
{
    internal static class Program
    {
        private const string ServerUrl = "http://127.0.0.1:4437/";
        private const int ServerPort = 4437;
        private const string ExpectedTitle = "한자 운명진";
        private const string LogFileName = "개발서버_실행.log";
        private const string StandardOutputLog = ".vite-dev.stdout.log";
        private const string StandardErrorLog = ".vite-dev.stderr.log";
        private const string StartScriptName = ".vite-dev-launch.cmd";
        private const string ExpectedPackageName = "\"name\": \"hanzi-random-tower-defense\"";

        private enum ProbeState
        {
            Free,
            Ready,
            OccupiedByAnotherService
        }

        [STAThread]
        private static int Main(string[] args)
        {
            string projectRoot = FindProjectRoot(AppDomain.CurrentDomain.BaseDirectory);
            string fallbackRoot = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory);
            string logPath = Path.Combine(projectRoot ?? fallbackRoot, LogFileName);
            bool noBrowser = HasArgument(args, "--no-browser");
            bool noOpenLog = HasArgument(args, "--no-open-log");

            try
            {
                WriteLog(logPath, "런처 시작");
                if (projectRoot == null)
                {
                    return Fail(logPath, "package.json과 index.html이 있는 프로젝트 폴더를 찾지 못했습니다. EXE를 프로젝트 루트에 놓아주세요.", noOpenLog);
                }

                string packageJson = Path.Combine(projectRoot, "package.json");
                string viteCommand = Path.Combine(projectRoot, "node_modules", ".bin", "vite.cmd");
                string npmCommand = FindCommandOnPath("npm.cmd");
                bool prerequisitesReady = File.Exists(packageJson) && File.Exists(viteCommand) && npmCommand != null;
                ProbeState initialState = Probe();

                if (HasArgument(args, "--check"))
                {
                    WriteLog(logPath, "점검 완료 · 필수 파일=" + prerequisitesReady + " · 서버 상태=" + initialState);
                    return prerequisitesReady ? 0 : 2;
                }

                if (initialState == ProbeState.Ready)
                {
                    WriteLog(logPath, "기존 개발 서버 확인 · 브라우저 열기");
                    if (!noBrowser) OpenBrowser();
                    return 0;
                }

                if (initialState == ProbeState.OccupiedByAnotherService)
                {
                    return Fail(logPath, "포트 " + ServerPort + "을 다른 프로그램이 사용 중입니다. 해당 프로그램을 종료한 뒤 다시 실행해주세요.", noOpenLog);
                }

                if (!prerequisitesReady)
                {
                    return Fail(logPath, "Node.js 또는 node_modules가 준비되지 않았습니다. 프로젝트 폴더에서 npm.cmd ci를 한 번 실행한 뒤 다시 시도해주세요.", noOpenLog);
                }

                string stdoutPath = Path.Combine(projectRoot, StandardOutputLog);
                string stderrPath = Path.Combine(projectRoot, StandardErrorLog);
                Process serverShell = StartVite(projectRoot, npmCommand, stdoutPath, stderrPath);
                WriteLog(logPath, "Vite 시작 요청 · stdout=" + stdoutPath + " · stderr=" + stderrPath);

                try
                {
                    for (int attempt = 0; attempt < 40; attempt += 1)
                    {
                        Thread.Sleep(500);
                        ProbeState state = Probe();
                        if (state == ProbeState.Ready)
                        {
                            WriteLog(logPath, "준비 완료 · " + ServerUrl);
                            if (!noBrowser) OpenBrowser();
                            return 0;
                        }

                        if (state == ProbeState.OccupiedByAnotherService)
                        {
                            return Fail(logPath, "서버 시작 중 포트 " + ServerPort + "이 다른 서비스에 점유되었습니다.", noOpenLog);
                        }

                        if (serverShell.HasExited)
                        {
                            return Fail(logPath, "Vite 프로세스가 준비 전에 종료되었습니다." + Environment.NewLine + ReadTail(stderrPath, 24), noOpenLog);
                        }
                    }
                }
                finally
                {
                    serverShell.Dispose();
                }

                string errorTail = ReadTail(stderrPath, 24);
                return Fail(logPath, "20초 안에 개발 서버가 준비되지 않았습니다." + Environment.NewLine + errorTail, noOpenLog);
            }
            catch (Exception exception)
            {
                return Fail(logPath, "예상하지 못한 런처 오류: " + exception, noOpenLog);
            }
        }

        private static bool HasArgument(string[] args, string expected)
        {
            return args.Any(argument => string.Equals(argument, expected, StringComparison.OrdinalIgnoreCase));
        }

        private static string FindProjectRoot(string startDirectory)
        {
            DirectoryInfo directory = new DirectoryInfo(Path.GetFullPath(startDirectory));
            for (int depth = 0; directory != null && depth < 7; depth += 1, directory = directory.Parent)
            {
                if (IsDefenseProject(directory.FullName)) return directory.FullName;
            }

            return null;
        }

        private static bool IsDefenseProject(string directory)
        {
            try
            {
                string packageJson = Path.Combine(directory, "package.json");
                string indexHtml = Path.Combine(directory, "index.html");
                return File.Exists(packageJson) &&
                       File.Exists(indexHtml) &&
                       File.ReadAllText(packageJson, Encoding.UTF8).IndexOf(ExpectedPackageName, StringComparison.Ordinal) >= 0;
            }
            catch
            {
                return false;
            }
        }

        private static string FindCommandOnPath(string command)
        {
            string path = Environment.GetEnvironmentVariable("PATH");
            if (string.IsNullOrWhiteSpace(path)) return null;
            foreach (string rawSegment in path.Split(new[] { Path.PathSeparator }, StringSplitOptions.RemoveEmptyEntries))
            {
                try
                {
                    string segment = rawSegment.Trim().Trim('"');
                    string candidate = Path.Combine(segment, command);
                    if (File.Exists(candidate)) return candidate;
                }
                catch
                {
                    // Ignore malformed PATH entries and continue with the next one.
                }
            }

            return null;
        }

        private static Process StartVite(string projectRoot, string npmCommand, string stdoutPath, string stderrPath)
        {
            string scriptPath = Path.Combine(projectRoot, StartScriptName);
            string script = "@echo off\r\n" +
                            "call \"" + npmCommand + "\" run dev 1>>\"" + Path.GetFileName(stdoutPath) + "\" 2>>\"" + Path.GetFileName(stderrPath) + "\"\r\n";
            File.WriteAllText(scriptPath, script, Encoding.ASCII);

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe";
            startInfo.Arguments = "/d /s /c \"\"" + scriptPath + "\"\"";
            startInfo.WorkingDirectory = projectRoot;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;

            Process process = Process.Start(startInfo);
            if (process == null) throw new InvalidOperationException("npm 개발 서버 프로세스를 시작하지 못했습니다.");
            return process;
        }

        private static ProbeState Probe()
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(ServerUrl);
                request.Timeout = 1400;
                request.ReadWriteTimeout = 1400;
                request.UserAgent = "HanziFateFormation-DevLauncher/1.0";
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                using (StreamReader reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
                {
                    string html = reader.ReadToEnd();
                    return html.IndexOf(ExpectedTitle, StringComparison.Ordinal) >= 0
                        ? ProbeState.Ready
                        : ProbeState.OccupiedByAnotherService;
                }
            }
            catch
            {
                return IsPortOpen() ? ProbeState.OccupiedByAnotherService : ProbeState.Free;
            }
        }

        private static bool IsPortOpen()
        {
            using (TcpClient client = new TcpClient())
            {
                try
                {
                    IAsyncResult result = client.BeginConnect("127.0.0.1", ServerPort, null, null);
                    using (WaitHandle waitHandle = result.AsyncWaitHandle)
                    {
                        if (!waitHandle.WaitOne(500)) return false;
                        client.EndConnect(result);
                        return client.Connected;
                    }
                }
                catch
                {
                    return false;
                }
            }
        }

        private static void OpenBrowser()
        {
            Process.Start(new ProcessStartInfo(ServerUrl) { UseShellExecute = true });
        }

        private static int Fail(string logPath, string message, bool noOpenLog)
        {
            WriteLog(logPath, "실패 · " + message);
            if (!noOpenLog)
            {
                try
                {
                    Process.Start(new ProcessStartInfo("notepad.exe", "\"" + logPath + "\"") { UseShellExecute = true });
                }
                catch
                {
                    // The log remains available next to the launcher even if Notepad cannot be opened.
                }
            }

            return 1;
        }

        private static void WriteLog(string logPath, string message)
        {
            string line = "[" + DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss zzz") + "] " + message + Environment.NewLine;
            File.AppendAllText(logPath, line, new UTF8Encoding(false));
        }

        private static string ReadTail(string path, int maxLines)
        {
            if (!File.Exists(path)) return "오류 로그가 생성되지 않았습니다.";
            string[] lines = File.ReadAllLines(path);
            int start = Math.Max(0, lines.Length - maxLines);
            return string.Join(Environment.NewLine, lines.Skip(start).ToArray());
        }
    }
}
