import sys
import json
import io
import traceback

steps = []
stdout_lines = []
accumulated_output = ""

class TracerOutput(io.StringIO):
    def __init__(self, callback):
        super().__init__()
        self._callback = callback
    def write(self, s):
        self._callback(s)
        return len(s)
    def flush(self):
        pass

def serialize_value(v):
    if isinstance(v, (int, float, bool, str, type(None))):
        return v
    if isinstance(v, (list, tuple)):
        return [serialize_value(i) for i in v]
    if isinstance(v, dict):
        return {str(k): serialize_value(vv) for k, vv in list(v.items())[:20]}
    if isinstance(v, set):
        return list(serialize_value(i) for i in list(v)[:20])
    return str(v)

def get_type_name(v):
    if isinstance(v, bool): return "bool"
    if isinstance(v, int): return "int"
    if isinstance(v, float): return "float"
    if isinstance(v, str): return "str"
    if isinstance(v, list): return "list"
    if isinstance(v, tuple): return "tuple"
    if isinstance(v, dict): return "dict"
    if isinstance(v, set): return "set"
    if v is None: return "None"
    return type(v).__name__

def make_tracer(user_code_lines, filename):
    global accumulated_output
    last_locals = {}

    def tracer(frame, event, arg):
        nonlocal last_locals
        global accumulated_output
        if frame.f_code.co_filename != filename:
            return tracer
        if event in ('line', 'return'):
            line_no = frame.f_lineno
            raw_locals = {
                k: v for k, v in frame.f_locals.items()
                if not k.startswith('__')
            }
            variables = {}
            for k, v in raw_locals.items():
                try:
                    variables[k] = {
                        "value": serialize_value(v),
                        "type": get_type_name(v)
                    }
                except Exception:
                    variables[k] = {"value": str(v), "type": "unknown"}

            call_stack = []
            f = frame
            while f is not None:
                if f.f_code.co_filename == filename:
                    call_stack.append({
                        "funcName": f.f_code.co_name,
                        "line": f.f_lineno
                    })
                f = f.f_back

            step = {
                "line": line_no,
                "variables": variables,
                "stdout": accumulated_output,
                "callStack": call_stack[::-1],
                "event": event
            }
            steps.append(step)
            accumulated_output = ""
        return tracer
    return tracer

if __name__ == "__main__":
    import tempfile, os
    user_code = sys.stdin.read()
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(user_code)
        tmp_path = f.name

    try:
        code_obj = compile(user_code, tmp_path, 'exec')
    except SyntaxError as e:
        result = {
            "success": False,
            "error": str(e),
            "errorLine": e.lineno,
            "steps": [],
            "output": ""
        }
        print(json.dumps(result))
        os.unlink(tmp_path)
        sys.exit(0)

    full_output_lines = []

    def capture_print(s):
        global accumulated_output
        accumulated_output += s
        full_output_lines.append(s)

    fake_stdout = TracerOutput(capture_print)
    sys.stdout = fake_stdout

    global_ns = {
        "__name__": "__main__",
        "__file__": tmp_path,
        "__builtins__": __builtins__,
    }

    sys.settrace(make_tracer(user_code.splitlines(), tmp_path))
    try:
        exec(code_obj, global_ns)
        sys.settrace(None)
        result = {
            "success": True,
            "steps": steps,
            "output": "".join(full_output_lines)
        }
    except Exception as e:
        sys.settrace(None)
        tb = traceback.format_exc()
        result = {
            "success": False,
            "error": str(e),
            "traceback": tb,
            "steps": steps,
            "output": "".join(full_output_lines)
        }

    sys.stdout = sys.__stdout__
    print(json.dumps(result))
    os.unlink(tmp_path)
