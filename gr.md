### GitHub Release Assets 加速

**作者**：[achtlv](https://achtlv.ccwu.cc/c/)

基于Cloudflare Workers，快速获取指定的GitHub Release Assets并重定向至加速链接。

#### 功能

 - 支持1~4段路径，适配不同场景
 - 支持关键词搜索匹配仓库
 - 可指定作者、仓库、release tag和assets
 - 支持数字索引（如/1/）和关键词匹配（如/apk/）选择assets
 - 重定向至加速域名 [d.achtlv.ccwu.cc](https://d.achtlv.ccwu.cc/)
 - 所有请求经由Cloudflare，本地无直连GitHub

#### 用法

**1段路径**

```
gr.achtlv.ccwu.cc/<关键词>/
```
 - 在GitHub内使用关键词（区分大小写）搜索仓库，提取搜索结果中第1个仓库的最新release（不包括预发布）的第1个assets

**2段路径**

```
gr.achtlv.ccwu.cc/<关键词>/<选择器>/
```
 - 在GitHub上使用关键词搜索仓库，提取搜索结果中第1个仓库的最新release（不包括预发布）的assets列表
 - 选择器为数字或关键词，优先作为数字，若为非纯数字，则作为关键词
 - 选择器作为数字：提取列表里从上到下第n个assets（从1开始）
 - 选择器作为关键词：提取第1个文件名包含该词（区分大小写）的assets

**3段路径**

```
gr.achtlv.ccwu.cc/<作者>/<仓库>/<选择器>/
```
 - 提取GitHub上对应作者对应仓库的最新release的assets列表
 - 选择器功能同上

**4段路径**

```
gr.achtlv.ccwu.cc/<作者>/<仓库>/<release tag>/<选择器>/
```
 - 提取GitHub上对应作者对应仓库对应release的assets列表
 - 选择器功能同上

#### 示例

 - gr.achtlv.ccwu.cc/FlClash/
 - gr.achtlv.ccwu.cc/FlClash/1/
 - gr.achtlv.ccwu.cc/FlClash/apk/
 - gr.achtlv.ccwu.cc/MetaCubeX/ClashMetaForAndroid/1/
 - gr.achtlv.ccwu.cc/MetaCubeX/ClashMetaForAndroid/apk/
 - gr.achtlv.ccwu.cc/clashbk/clash_for_android/2.5.12/1/
 - gr.achtlv.ccwu.cc/clashbk/clash_for_android/2.5.12/apk/

#### 开源许可&源码

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt) & [源码](https://v6.gh-proxy.org/https://raw.githubusercontent.com/achtlv/achtlv.github.io/refs/heads/main/gr/worker.js)