var annotation = require('css-annotation');

exports.setModules = function (syntaxHighlighter, markdownParser) {
  this.syntaxHighlighter = syntaxHighlighter;
  this.markdownParser = markdownParser;
};

exports.analyze = function (root, opts) {
    var list = [];
    var linkId = 0;
    var delimiter = /[.-]/;
    root.walkComments(function (comment) {
        var meta = annotation.read(comment.text);
        if (!meta.documents && !meta.document && !meta.docs && !meta.doc && !meta.styleguide) {
            return;
        }
        if (comment.parent.type !== 'root') {
            return;
        }
        var rules = [];
        var rule = comment.next();
        while (rule && rule.type !== 'comment') {
            if (rule.type === 'rule' || rule.type === 'atrule') {
                rules.push(rule.toString());
            }
            rule = rule.next();
        }
        var joined = rules.join('\n\n');
        var depth = meta.id ? meta.id.split(delimiter) : [];
        var md = comment.text.replace(/(@document|@doc|@docs|@styleguide)\s*\n/, '');
        md = md.replace(new RegExp('@(' + Object.keys(meta).join('|') + ')\\s.*\\n', 'g'), '');

        md = md.replace(/@title\s.*\n/, '');
        md = md.replace(/@id\s.*\n/, '');

        list.push({
            meta: meta,
            rule: this.syntaxHighlighter.highlight(joined),
            html: this.markdownParser(md),
            parentId: depth.slice(0, - 1).join('.') || 'root',
            link: {
                id: (meta.id || 'psg-link-' + linkId),
                title: meta.title || null,
                depth: depth.length || 0
            }
        });
        linkId++;
    }.bind(this));

    list = list.sort(function (a, b) {
        var refsA = a.link.id.toLowerCase().split(delimiter),
            refsB = b.link.id.toLowerCase().split(delimiter),
            weightA, weightB,
            maxRefLength = Math.max(refsA.length, refsB.length),
            minRefLength = Math.min(refsA.length, refsB.length);

        for (var i = 0; i < maxRefLength; i++) {
            if (refsA[i] && refsB[i]) {
                // If the 2 chunks are unequal, compare them.
                if (refsA[i] !== refsB[i]) {
                    // If the chunks have different weights, sort by weight.
                    weightA = a.link.id.toLowerCase().split(delimiter, minRefLength).join('');
                    weightB = b.link.id.toLowerCase().split(delimiter, minRefLength).join('');
                    if (weightA !== weightB) {
                        return weightA - weightB;
                    } else if (refsA[i].match(/^\d+$/) && refsB[i].match(/^\d+$/)) {
                        // If both chunks are digits, use numeric sorting.
                        return refsA[i] - refsB[i];
                    } else {
                        // Otherwise, use alphabetical string sorting.
                        return (refsA[i] > refsB[i]) ? 1 : -1;
                    }
                }
            } else {
                // If 1 of the chunks is empty, it goes first.
                return refsA[i] ? 1 : -1;
            }
        }

        return 0;
    });

    return list = listToTree(list);
};

function listToTree(list) {
    var map = {}, node, roots = [], i;

    for (i = 0; i < list.length; i += 1) {
        map[list[i].link.id] = i;
        list[i].children = [];
    }
    for (i = 0; i < list.length; i += 1) {
        node = list[i];
        if (node.parentId !== 'root' && map[node.parentId] > -1) {
            list[map[node.parentId]].children.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}
