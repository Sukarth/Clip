{
    "targets": [
        {
            "target_name": "clipmsg",
            "sources": ["clipmsg.cpp"],
            "include_dirs": [
                "<!(node -p \"require('node-addon-api').include\")",
                "<!(node -p \"require('node-addon-api').include_dir\")",
            ],
            "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
            "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
            "cflags!": ["-fno-exceptions"],
            "cflags_cc!": ["-fno-exceptions"],
        }
    ]
}
