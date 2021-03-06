var lang = fis.compile.lang;
var rRequire = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]+?(?:\*\/|$))|\b(require\.async|require\.ensure|require)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|\[[\s\S]*?\])\s*/g;
var umd2commonjs = require('./umd2commonjs.js')

module.exports = function (info, opts) {
    var content = info.content;
    var file = info.file;
    var ignoreDependencies = opts.ignoreDependencies || [];
    var isIgnored = function (str) {
        var found = false;

        if (/^('|").*\1$/.test(str)) {
            str = str.substring(1, str.length - 1);
        }

        if (!/^\.*\//.test(str)) {
            str = '/' + str;
        }

        ignoreDependencies.every(function (item) {
            if (item && item.exec && item.exec(str)) {
                found = true;
                return false;
            }
            return true;
        });

        return found;
    };


    // 如果标记了需要将 amd 转成 commonjs 规范
    if (file.umd2commonjs) {
        content = umd2commonjs(content, file);
    }

    // 文件属性上设置了，则直接跳过依赖分析部分。
    if (file.ignoreDependencies) {
        return;
    }

    var asyncScripts = [],
        syncScripts = [];

    info.content = content.replace(rRequire, function (m, comment, type, params) {
        if (type) {
            switch (type) {
                case 'require.async':
                    var info = parseParams(params);

                    m = 'require.async([' + info.params.map(function (v) {
                            var type = lang.jsAsync;
                            return isIgnored(v) ? v : type.wrap(v);
                        }).join(',') + ']';

                    if (file.dynamicRequire) {
                        info.params.forEach(p => {
                            return asyncScripts.push(p);
                        });
                    }

                    break;

                case 'require.ensure':
                    var info = parseParams(params);

                    m = 'require.ensure([' + info.params.map(function (v) {
                            var type = lang.jsAsync;
                            return isIgnored(v) ? v : type.wrap(v);
                        }).join(',') + ']';

                    if (file.dynamicRequire) {
                        info.params.forEach(p => {
                            return asyncScripts.push(p);
                        });
                    }
                    break;

                case 'require':
                    var info = parseParams(params);
                    var async = info.hasBrackets;

                    m = 'require(' + (async ? '[' : '') + info.params.map(function (v) {
                            var type = lang[async ? 'jsAsync' : 'jsRequire'];
                            return isIgnored(v) ? v : type.wrap(v);
                        }).join(',') + (async ? ']' : '');

                    if (file.dynamicRequire) {
                        info.params.forEach(p => {
                            if (async) {
                                return asyncScripts.push(p);
                            } else {
                                return syncScripts.push(p);
                            }
                        });
                    }

                    break;
            }
        }

        return m;
    });

    if (file.dynamicRequire) {
        var code = '';
        if (syncScripts.length) {
            code += `"@btccom.sync:${syncScripts.map(p => lang.id.wrap(p.replace(/"/g, "'"))).join('|')}"\n`;
        }
        if (asyncScripts.length) {
            code += `"@btccom.async:${asyncScripts.map(p => lang.id.wrap(p.replace(/"/g, "'"))).join('|')}"\n`;
        }
        info.content = code + info.content;
    }
};

function parseParams(value) {
    var hasBrackets = false;
    var params = [];

    value = value.trim().replace(/(^\[|\]$)/g, function (m, v) {
        if (v) {
            hasBrackets = true;
        }
        return '';
    });
    params = value.split(/\s*,\s*/);

    return {
        params: params,
        hasBrackets: hasBrackets
    };
}
