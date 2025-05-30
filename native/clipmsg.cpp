#include <napi.h>
#include <windows.h>

static HWND g_hwnd = NULL;
static UINT g_customMsg = 0;
static Napi::ThreadSafeFunction g_callback;
static WNDPROC g_originalProc = NULL;

LRESULT CALLBACK SubclassProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam)
{
    if (msg == g_customMsg && g_callback)
    {
        g_callback.BlockingCall([](Napi::Env env, Napi::Function jsCallback)
                                { jsCallback.Call({}); });
        return 0;
    }
    return CallWindowProc(g_originalProc, hwnd, msg, wParam, lParam);
}

Napi::Value HookWindow(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 3)
        return env.Null();
    void *hwndBuf = info[0].As<Napi::Buffer<void>>().Data();
    g_hwnd = *(HWND *)hwndBuf;
    g_customMsg = info[1].As<Napi::Number>().Uint32Value();
    g_callback = Napi::ThreadSafeFunction::New(env, info[2].As<Napi::Function>(), "clipmsg-cb", 0, 1);
    g_originalProc = (WNDPROC)SetWindowLongPtrW(g_hwnd, GWLP_WNDPROC, (LONG_PTR)SubclassProc);
    return Napi::Boolean::New(env, true);
}

Napi::Value GetForegroundWindowWrapped(const Napi::CallbackInfo &info)
{
    HWND hwnd = GetForegroundWindow();
    // Return as a JavaScript Number (unsigned integer)
    return Napi::Number::New(info.Env(), reinterpret_cast<uintptr_t>(hwnd));
}

Napi::Value SetForegroundWindowWrapped(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1) {
        return Napi::Boolean::New(env, false);
    }
    
    // Get HWND from the argument (should be a number)
    uintptr_t hwndValue = info[0].As<Napi::Number>().Uint32Value();
    HWND hwnd = reinterpret_cast<HWND>(hwndValue);
    
    // Call Windows API to set foreground window
    BOOL result = SetForegroundWindow(hwnd);
    return Napi::Boolean::New(env, result == TRUE);
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set("hookWindow", Napi::Function::New(env, HookWindow));
    exports.Set("getForegroundWindow", Napi::Function::New(env, GetForegroundWindowWrapped));
    exports.Set("setForegroundWindow", Napi::Function::New(env, SetForegroundWindowWrapped));
    return exports;
}

NODE_API_MODULE(clipmsg, Init)
