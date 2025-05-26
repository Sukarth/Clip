#include <windows.h>
#include <cstdio>
#include <string>
#include <sstream>
#include <shlwapi.h>
#pragma comment(lib, "shlwapi.lib")

int main(int argc, char *argv[])
{
    printf("---\n");
    HWND hwnd = NULL;
    if (argc > 1)
    {
        // Parse HWND from command-line argument
        uintptr_t hwndInt = 0;
        sscanf(argv[1], "%llu", &hwndInt);
        hwnd = (HWND)hwndInt;
        printf("Arg HWND: %p\n", hwnd);
    }
    if (!hwnd)
    {
        hwnd = GetForegroundWindow();
        printf("Fallback GetForegroundWindow: %p\n", hwnd);
    }
    if (hwnd == NULL)
    {
        printf("ERROR: hwnd is NULL\n");
        return 1;
    }

    // 1) Get the focused window/control (may be a child of hwnd)
    GUITHREADINFO ti = {sizeof(ti)};
    HWND hwndFocus = hwnd;
    if (GetGUIThreadInfo(0, &ti) && ti.hwndFocus)
    {
        hwndFocus = ti.hwndFocus;
        printf("GetGUIThreadInfo hwndFocus: %p\n", hwndFocus);
    }
    else
    {
        printf("GetGUIThreadInfo failed or no hwndFocus\n");
    }

    // 2) Get class name
    WCHAR cls[64] = {0};
    GetClassNameW(hwndFocus, cls, 63);
    wprintf(L"Class: %s\n", cls);

    // 3) Dispatch based on class
    if (_wcsicmp(cls, L"ConsoleWindowClass") == 0)
    {
        printf("Branch: ConsoleWindowClass\n");
        // Console: send WM_COMMAND paste
        SendMessageW(hwndFocus, WM_COMMAND, 0xFFF1, 0);
    }
    else if (_wcsicmp(cls, L"Edit") == 0 || wcsstr(cls, L"RichEdit") != NULL)
    {
        printf("Branch: Edit/RichEdit\n");
        // Standard edit/rich edit: send WM_PASTE
        SendMessageW(hwndFocus, WM_PASTE, 0, 0);
    }
    else if (_wcsicmp(cls, L"ComboBox") == 0)
    {
        printf("Branch: ComboBox\n");
        // ComboBox: find edit child
        HWND hwndEdit = FindWindowExW(hwndFocus, NULL, L"Edit", NULL);
        if (hwndEdit)
        {
            printf("Branch: ComboBox->Edit\n");
            SendMessageW(hwndEdit, WM_PASTE, 0, 0);
        }
        else
        {
            printf("Branch: ComboBox fallback\n");
            // fallback
            goto Simulate;
        }
    }
    else
    {
    Simulate:
        printf("Branch: Simulate (SendInput)\n");
        // fallback: real keystrokes
        SetForegroundWindow(hwnd);
        INPUT in[4] = {};
        in[0].type = INPUT_KEYBOARD;
        in[0].ki.wVk = VK_CONTROL;
        in[1].type = INPUT_KEYBOARD;
        in[1].ki.wVk = 'V';
        in[2] = in[1];
        in[2].ki.dwFlags = KEYEVENTF_KEYUP;
        in[3] = in[0];
        in[3].ki.dwFlags = KEYEVENTF_KEYUP;
        UINT sent = SendInput(4, in, sizeof(INPUT));
        printf("SendInput sent: %u\n", sent);
    }
    return 0;
}